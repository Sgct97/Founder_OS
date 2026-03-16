/**
 * TourOverlay — premium spotlight + tooltip overlay for guided onboarding.
 *
 * Renders a full-screen dark backdrop with a rounded spotlight cutout
 * around the target element, plus a glass-style tooltip with navigation.
 */

import React, { useEffect, useRef } from "react";
import {
  Animated,
  Dimensions,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import {
  BORDER_RADIUS,
  COLORS,
  FONT_SIZE,
  FONT_WEIGHT,
  SHADOW,
  SPACING,
} from "@/constants/theme";
import { useTour, type ElementLayout } from "./TourProvider";
import type { TourPage } from "./tourSteps";

const SPOTLIGHT_PADDING = 8;
const SPOTLIGHT_RADIUS = 12;
const TOOLTIP_WIDTH = 300;
const ARROW_SIZE = 8;

const PAGE_LABELS: Record<TourPage, { label: string; icon: string }> = {
  milestones: { label: "Milestones", icon: "flag-outline" },
  requests: { label: "Requests", icon: "bulb-outline" },
  diary: { label: "Diary", icon: "journal-outline" },
  knowledge: { label: "Knowledge", icon: "library-outline" },
  settings: { label: "Settings", icon: "settings-outline" },
};

export function TourOverlay(): React.JSX.Element | null {
  const {
    isActive,
    currentStep,
    currentStepIndex,
    totalSteps,
    currentPage,
    targetLayout,
    nextStep,
    prevStep,
    skipTour,
  } = useTour();

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const tooltipSlide = useRef(new Animated.Value(20)).current;
  const pulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isActive && currentStep) {
      fadeAnim.setValue(0);
      tooltipSlide.setValue(20);

      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(tooltipSlide, {
          toValue: 0,
          duration: 350,
          useNativeDriver: true,
        }),
      ]).start();

      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1200,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 0,
            duration: 1200,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();

      return () => pulse.stop();
    }
  }, [isActive, currentStep, currentStepIndex, fadeAnim, tooltipSlide, pulseAnim]);

  if (!isActive || !currentStep) return null;

  const { width: screenW, height: screenH } = Dimensions.get("window");
  const isLastStep = currentStepIndex === totalSteps - 1;
  const isFirstStep = currentStepIndex === 0;

  const pageInfo = currentPage ? PAGE_LABELS[currentPage] : null;
  const showNavigatePrompt = !targetLayout && currentStep;

  const spotlightStyle = targetLayout
    ? {
        left: targetLayout.x - SPOTLIGHT_PADDING,
        top: targetLayout.y - SPOTLIGHT_PADDING,
        width: targetLayout.width + SPOTLIGHT_PADDING * 2,
        height: targetLayout.height + SPOTLIGHT_PADDING * 2,
        borderRadius: SPOTLIGHT_RADIUS,
      }
    : null;

  const tooltipPosition = computeTooltipPosition(
    targetLayout,
    currentStep.position,
    screenW,
    screenH
  );

  const pulseScale = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.06],
  });

  const pulseOpacity = pulseAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.6, 1, 0.6],
  });

  return (
    <Animated.View
      style={[styles.overlay, { opacity: fadeAnim }]}
      pointerEvents="box-none"
    >
      {/* Dark backdrop — tappable to advance */}
      <Pressable style={styles.backdrop} onPress={nextStep}>
        <View style={StyleSheet.absoluteFill} />
      </Pressable>

      {/* Spotlight cutout */}
      {spotlightStyle && (
        <>
          <Animated.View
            style={[
              styles.spotlightRing,
              spotlightStyle,
              {
                transform: [{ scale: pulseScale }],
                opacity: pulseOpacity,
              },
            ]}
            pointerEvents="none"
          />
          <View
            style={[styles.spotlightCutout, spotlightStyle]}
            pointerEvents="none"
          />
        </>
      )}

      {/* Navigate-to-tab prompt (when element isn't on current page) */}
      {showNavigatePrompt && pageInfo && (
        <Animated.View
          style={[
            styles.navigatePrompt,
            { opacity: fadeAnim, transform: [{ translateY: tooltipSlide }] },
          ]}
        >
          <Ionicons
            name={pageInfo.icon as any}
            size={28}
            color={COLORS.primary}
          />
          <Text style={styles.navigateText}>
            Tap the{" "}
            <Text style={styles.navigateHighlight}>{pageInfo.label}</Text> tab
            below to continue
          </Text>
        </Animated.View>
      )}

      {/* Tooltip */}
      {(targetLayout || !showNavigatePrompt) && (
        <Animated.View
          style={[
            styles.tooltip,
            tooltipPosition,
            {
              opacity: fadeAnim,
              transform: [{ translateY: tooltipSlide }],
            },
          ]}
        >
          {/* Step badge */}
          <View style={styles.tooltipHeader}>
            <View style={styles.stepBadge}>
              <Text style={styles.stepBadgeText}>
                {currentStepIndex + 1} of {totalSteps}
              </Text>
            </View>
            <Pressable onPress={skipTour} hitSlop={12}>
              <Text style={styles.skipText}>Skip Tour</Text>
            </Pressable>
          </View>

          {/* Content */}
          <Text style={styles.tooltipTitle}>{currentStep.title}</Text>
          <Text style={styles.tooltipDesc}>{currentStep.description}</Text>

          {/* Progress dots */}
          <View style={styles.dotsRow}>
            {Array.from({ length: totalSteps }).map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  i === currentStepIndex && styles.dotActive,
                ]}
              />
            ))}
          </View>

          {/* Navigation buttons */}
          <View style={styles.navRow}>
            {!isFirstStep ? (
              <Pressable style={styles.backBtn} onPress={prevStep}>
                <Ionicons
                  name="chevron-back"
                  size={16}
                  color={COLORS.textSecondary}
                />
                <Text style={styles.backBtnText}>Back</Text>
              </Pressable>
            ) : (
              <View />
            )}
            <Pressable
              style={styles.nextBtn}
              onPress={nextStep}
            >
              <Text style={styles.nextBtnText}>
                {isLastStep ? "Finish" : "Next"}
              </Text>
              {!isLastStep && (
                <Ionicons
                  name="chevron-forward"
                  size={16}
                  color={COLORS.white}
                />
              )}
            </Pressable>
          </View>
        </Animated.View>
      )}
    </Animated.View>
  );
}

function computeTooltipPosition(
  target: ElementLayout | null,
  preferredPosition: string,
  screenW: number,
  screenH: number
) {
  if (!target) {
    return {
      left: (screenW - TOOLTIP_WIDTH) / 2,
      top: screenH * 0.35,
    };
  }

  const centerX = target.x + target.width / 2;
  let left = centerX - TOOLTIP_WIDTH / 2;
  left = Math.max(16, Math.min(left, screenW - TOOLTIP_WIDTH - 16));

  const below = target.y + target.height + SPOTLIGHT_PADDING + ARROW_SIZE + 8;
  const above = target.y - SPOTLIGHT_PADDING - ARROW_SIZE - 8;

  if (preferredPosition === "bottom" && below + 200 < screenH) {
    return { left, top: below };
  }
  if (preferredPosition === "top" && above > 100) {
    return { left, top: above - 180 };
  }
  if (below + 200 < screenH) {
    return { left, top: below };
  }
  return { left, top: Math.max(80, above - 180) };
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.78)",
  },

  spotlightCutout: {
    position: "absolute",
    backgroundColor: "transparent",
    borderWidth: 2,
    borderColor: COLORS.primaryGlow,
    ...(Platform.OS === "web"
      ? { boxShadow: `0 0 0 9999px rgba(0,0,0,0.78), 0 0 20px ${COLORS.primaryGlow}` }
      : {}),
  },
  spotlightRing: {
    position: "absolute",
    borderWidth: 2,
    borderColor: COLORS.primary,
    backgroundColor: "transparent",
  },

  navigatePrompt: {
    position: "absolute",
    bottom: 120,
    left: 0,
    right: 0,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: SPACING.xl,
  },
  navigateText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.md,
    textAlign: "center",
    lineHeight: 22,
  },
  navigateHighlight: {
    color: COLORS.primary,
    fontWeight: FONT_WEIGHT.bold,
  },

  tooltip: {
    position: "absolute",
    width: TOOLTIP_WIDTH,
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderTopWidth: 2,
    borderTopColor: COLORS.primary,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    ...SHADOW.glow,
    ...(Platform.OS === "web"
      ? { backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)" }
      : {}),
  },

  tooltipHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING.sm,
  },
  stepBadge: {
    backgroundColor: COLORS.primaryMuted,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: BORDER_RADIUS.full,
  },
  stepBadgeText: {
    color: COLORS.primary,
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.semibold,
    letterSpacing: 0.3,
  },
  skipText: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.medium,
  },

  tooltipTitle: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.bold,
    letterSpacing: -0.3,
    marginBottom: 6,
  },
  tooltipDesc: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.sm,
    lineHeight: 20,
    marginBottom: SPACING.md,
  },

  dotsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 4,
    marginBottom: SPACING.md,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.navySoft,
  },
  dotActive: {
    width: 18,
    borderRadius: 3,
    backgroundColor: COLORS.primary,
  },

  navRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: BORDER_RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  backBtnText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.medium,
  },
  nextBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: COLORS.primary,
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: BORDER_RADIUS.full,
    ...SHADOW.glow,
  },
  nextBtnText: {
    color: COLORS.white,
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.bold,
    letterSpacing: 0.2,
  },
});
