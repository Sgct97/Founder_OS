/**
 * TourOverlay — premium onboarding overlay inspired by Linear/Notion.
 *
 * Semi-transparent backdrop (content stays visible), soft floating
 * tooltip card with glassmorphism, gentle spotlight glow around
 * target elements.
 */

import React, { useEffect, useRef } from "react";
import {
  Animated,
  Dimensions,
  Platform,
  Pressable,
  ScrollView,
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
  SPACING,
} from "@/constants/theme";
import { useTour, type ElementLayout } from "./TourProvider";

const SPOTLIGHT_PADDING = 12;
const TOOLTIP_WIDTH = 360;

export function TourOverlay(): React.JSX.Element | null {
  const {
    isActive,
    currentStep,
    currentStepIndex,
    totalSteps,
    targetLayout,
    nextStep,
    prevStep,
    skipTour,
  } = useTour();

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const tooltipSlide = useRef(new Animated.Value(16)).current;
  const pulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isActive && currentStep) {
      fadeAnim.setValue(0);
      tooltipSlide.setValue(16);

      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(tooltipSlide, {
          toValue: 0,
          duration: 450,
          useNativeDriver: true,
        }),
      ]).start();

      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 0,
            duration: 2000,
            useNativeDriver: true,
          }),
        ]),
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [isActive, currentStep, currentStepIndex, fadeAnim, tooltipSlide, pulseAnim]);

  if (!isActive || !currentStep) return null;

  const { width: screenW, height: screenH } = Dimensions.get("window");
  const isLastStep = currentStepIndex === totalSteps - 1;
  const isFirstStep = currentStepIndex === 0;

  const spotlightStyle = targetLayout
    ? {
        left: targetLayout.x - SPOTLIGHT_PADDING,
        top: targetLayout.y - SPOTLIGHT_PADDING,
        width: targetLayout.width + SPOTLIGHT_PADDING * 2,
        height: targetLayout.height + SPOTLIGHT_PADDING * 2,
        borderRadius: 16,
      }
    : null;

  const tooltipPosition = computeTooltipPosition(
    targetLayout,
    currentStep.position,
    screenW,
    screenH,
  );

  const pulseOpacity = pulseAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.4, 0.8, 0.4],
  });

  const progressPct = ((currentStepIndex + 1) / totalSteps) * 100;

  return (
    <Animated.View
      style={[styles.overlay, { opacity: fadeAnim }]}
      pointerEvents="box-none"
    >
      {/* Glow ring around target */}
      {spotlightStyle && (
        <Animated.View
          style={[
            styles.spotlightGlow,
            spotlightStyle,
            { opacity: pulseOpacity },
          ]}
          pointerEvents="none"
        />
      )}

      {/* Floating tooltip card */}
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
        {/* Top bar: progress + skip */}
        <View style={styles.topBar}>
          <View style={styles.progressContainer}>
            <View style={styles.progressTrack}>
              <View
                style={[styles.progressFill, { width: `${progressPct}%` }]}
              />
            </View>
            <Text style={styles.progressLabel}>
              {currentStepIndex + 1} of {totalSteps}
            </Text>
          </View>
          <Pressable onPress={skipTour} hitSlop={16} style={styles.skipBtn}>
            <Text style={styles.skipText}>Skip</Text>
            <Ionicons name="close" size={14} color="rgba(255,255,255,0.4)" />
          </Pressable>
        </View>

        {/* Content */}
        <Text style={styles.title}>{currentStep.title}</Text>
        <ScrollView
          style={styles.descScroll}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.desc}>{currentStep.description}</Text>
        </ScrollView>

        {/* Navigation */}
        <View style={styles.navRow}>
          {!isFirstStep ? (
            <Pressable style={styles.backBtn} onPress={prevStep}>
              <Ionicons
                name="arrow-back"
                size={15}
                color="rgba(255,255,255,0.6)"
              />
              <Text style={styles.backText}>Back</Text>
            </Pressable>
          ) : (
            <View />
          )}
          <Pressable style={styles.nextBtn} onPress={nextStep}>
            <Text style={styles.nextText}>
              {isLastStep ? "Get Started" : "Continue"}
            </Text>
            <Ionicons
              name={isLastStep ? "checkmark" : "arrow-forward"}
              size={15}
              color="#fff"
            />
          </Pressable>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

function computeTooltipPosition(
  target: ElementLayout | null,
  preferredPosition: string,
  screenW: number,
  screenH: number,
) {
  if (!target) {
    return {
      left: (screenW - TOOLTIP_WIDTH) / 2,
      top: screenH * 0.3,
    };
  }

  const centerX = target.x + target.width / 2;
  let left = centerX - TOOLTIP_WIDTH / 2;
  left = Math.max(16, Math.min(left, screenW - TOOLTIP_WIDTH - 16));

  const gap = SPOTLIGHT_PADDING + 16;
  const below = target.y + target.height + gap;
  const above = target.y - gap;
  const tooltipEstHeight = 280;

  if (preferredPosition === "bottom" && below + tooltipEstHeight < screenH - 80) {
    return { left, top: below };
  }
  if (preferredPosition === "top" && above - tooltipEstHeight > 20) {
    return { left, top: above - tooltipEstHeight };
  }
  if (below + tooltipEstHeight < screenH - 80) {
    return { left, top: below };
  }
  return { left, top: Math.max(40, above - tooltipEstHeight) };
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
  },
  spotlightGlow: {
    position: "absolute",
    borderWidth: 2,
    borderColor: "rgba(255, 106, 42, 0.6)",
    backgroundColor: "transparent",
    ...(Platform.OS === "web"
      ? {
          boxShadow: `0 0 20px rgba(255, 106, 42, 0.35), 0 0 50px rgba(255, 106, 42, 0.15), inset 0 0 16px rgba(255, 106, 42, 0.06)`,
        }
      : {}),
  },

  tooltip: {
    position: "absolute",
    width: TOOLTIP_WIDTH,
    backgroundColor: "rgba(28, 28, 32, 0.92)",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 20,
    ...(Platform.OS === "web"
      ? {
          backdropFilter: "blur(40px) saturate(180%)",
          WebkitBackdropFilter: "blur(40px) saturate(180%)",
          boxShadow:
            "0 24px 80px rgba(0,0,0,0.5), 0 2px 16px rgba(0,0,0,0.3), 0 0 1px rgba(255,255,255,0.1)",
        }
      : {
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 16 },
          shadowOpacity: 0.5,
          shadowRadius: 40,
          elevation: 24,
        }),
  },

  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  progressContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
    marginRight: 12,
  },
  progressTrack: {
    height: 3,
    flex: 1,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: COLORS.primary,
    borderRadius: 2,
  },
  progressLabel: {
    color: "rgba(255, 255, 255, 0.35)",
    fontSize: 12,
    fontWeight: FONT_WEIGHT.medium,
    letterSpacing: 0.3,
  },
  skipBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
  },
  skipText: {
    color: "rgba(255, 255, 255, 0.4)",
    fontSize: 12,
    fontWeight: FONT_WEIGHT.medium,
  },

  title: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: -0.4,
    marginBottom: 10,
    lineHeight: 26,
  },
  descScroll: {
    maxHeight: 110,
    marginBottom: 18,
  },
  desc: {
    color: "rgba(255, 255, 255, 0.55)",
    fontSize: 14,
    lineHeight: 22,
    letterSpacing: 0.1,
  },

  navRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
  },
  backText: {
    color: "rgba(255, 255, 255, 0.6)",
    fontSize: 14,
    fontWeight: FONT_WEIGHT.medium,
  },
  nextBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: COLORS.primary,
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 12,
    ...(Platform.OS === "web"
      ? {
          boxShadow: `0 4px 16px rgba(255, 106, 42, 0.3), 0 1px 4px rgba(255, 106, 42, 0.2)`,
        }
      : {
          shadowColor: COLORS.primary,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 12,
        }),
  },
  nextText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
});
