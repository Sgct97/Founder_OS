/**
 * TourProvider — manages guided onboarding tour state.
 *
 * Auto-navigates between tabs, measures target elements with
 * retry logic, and exposes step navigation actions.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Platform, type View } from "react-native";
import { useRouter, usePathname } from "expo-router";

import { useAuth } from "@/hooks/use-auth";
import { apiPost } from "@/services/api";
import {
  TOUR_STEPS,
  PAGE_ROUTES,
  type TourStep,
  type TourPage,
} from "./tourSteps";

export interface ElementLayout {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface TourContextValue {
  isActive: boolean;
  currentStep: TourStep | null;
  currentStepIndex: number;
  totalSteps: number;
  currentPage: TourPage | null;
  targetLayout: ElementLayout | null;
  registerStep: (key: string, ref: View | null) => void;
  nextStep: () => void;
  prevStep: () => void;
  skipTour: () => void;
}

const TourContext = createContext<TourContextValue | null>(null);

const MEASURE_RETRY_MS = 200;
const MEASURE_MAX_RETRIES = 15;

export function TourProvider({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [isActive, setIsActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [targetLayout, setTargetLayout] = useState<ElementLayout | null>(null);
  const refs = useRef<Map<string, View>>(new Map());
  const retryRef = useRef<ReturnType<typeof setTimeout>>();
  const retryCountRef = useRef(0);

  useEffect(() => {
    if (user && !user.has_completed_tour) {
      const timer = setTimeout(() => setIsActive(true), 1000);
      return () => clearTimeout(timer);
    }
  }, [user]);

  const currentStep = isActive ? TOUR_STEPS[stepIndex] ?? null : null;
  const currentPage = currentStep?.page ?? null;

  const measureElement = useCallback((key: string) => {
    const ref = refs.current.get(key);
    if (!ref) {
      if (retryCountRef.current < MEASURE_MAX_RETRIES) {
        retryCountRef.current += 1;
        retryRef.current = setTimeout(() => measureElement(key), MEASURE_RETRY_MS);
      }
      return;
    }

    if (Platform.OS === "web") {
      const node = ref as unknown as HTMLElement;
      if (node?.getBoundingClientRect) {
        const rect = node.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          setTargetLayout({
            x: rect.left,
            y: rect.top,
            width: rect.width,
            height: rect.height,
          });
          return;
        }
      }
      if (retryCountRef.current < MEASURE_MAX_RETRIES) {
        retryCountRef.current += 1;
        retryRef.current = setTimeout(() => measureElement(key), MEASURE_RETRY_MS);
      }
    } else {
      ref.measureInWindow((x, y, width, height) => {
        if (width > 0 && height > 0) {
          setTargetLayout({ x, y, width, height });
        } else if (retryCountRef.current < MEASURE_MAX_RETRIES) {
          retryCountRef.current += 1;
          retryRef.current = setTimeout(() => measureElement(key), MEASURE_RETRY_MS);
        }
      });
    }
  }, []);

  // Auto-navigate to the correct tab when the step's page changes.
  useEffect(() => {
    if (!currentStep) return;

    const targetRoute = PAGE_ROUTES[currentStep.page];
    if (targetRoute && !pathname.includes(currentStep.page === "requests" ? "features" : currentStep.page)) {
      router.navigate(targetRoute as any);
    }
  }, [currentStep, pathname, router]);

  // Measure the target element after navigation settles.
  useEffect(() => {
    if (!currentStep) {
      setTargetLayout(null);
      return;
    }

    if (retryRef.current) clearTimeout(retryRef.current);
    retryCountRef.current = 0;
    setTargetLayout(null);

    retryRef.current = setTimeout(
      () => measureElement(currentStep.targetKey),
      400,
    );

    return () => {
      if (retryRef.current) clearTimeout(retryRef.current);
    };
  }, [currentStep, measureElement, pathname]);

  const completeTour = useCallback(async () => {
    setIsActive(false);
    setStepIndex(0);
    setTargetLayout(null);
    try {
      await apiPost("/api/v1/auth/complete-tour", {});
    } catch (err) {
      console.warn("Failed to mark tour complete:", err);
    }
  }, []);

  const nextStep = useCallback(() => {
    if (stepIndex < TOUR_STEPS.length - 1) {
      setStepIndex((i) => i + 1);
    } else {
      completeTour();
    }
  }, [stepIndex, completeTour]);

  const prevStep = useCallback(() => {
    setStepIndex((i) => Math.max(0, i - 1));
  }, []);

  const skipTour = useCallback(() => {
    completeTour();
  }, [completeTour]);

  const registerStep = useCallback((key: string, ref: View | null) => {
    if (ref) {
      refs.current.set(key, ref);
    } else {
      refs.current.delete(key);
    }
  }, []);

  const value = useMemo<TourContextValue>(
    () => ({
      isActive,
      currentStep,
      currentStepIndex: stepIndex,
      totalSteps: TOUR_STEPS.length,
      currentPage,
      targetLayout,
      registerStep,
      nextStep,
      prevStep,
      skipTour,
    }),
    [
      isActive,
      currentStep,
      stepIndex,
      currentPage,
      targetLayout,
      registerStep,
      nextStep,
      prevStep,
      skipTour,
    ],
  );

  return <TourContext.Provider value={value}>{children}</TourContext.Provider>;
}

export function useTour(): TourContextValue {
  const ctx = useContext(TourContext);
  if (!ctx) {
    throw new Error("useTour must be used inside <TourProvider>");
  }
  return ctx;
}

/**
 * Hook for registering a UI element as a tour stop.
 * Returns a ref callback to attach to the target View.
 */
export function useTourRef(stepKey: string) {
  const { registerStep } = useTour();
  return useCallback(
    (ref: View | null) => registerStep(stepKey, ref),
    [registerStep, stepKey],
  );
}
