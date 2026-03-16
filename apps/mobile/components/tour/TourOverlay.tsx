/**
 * TourOverlay — premium spotlight + tooltip overlay for guided onboarding.
 *
 * Full-screen dark backdrop with a bright spotlight cutout around
 * the target element, animated tooltip with educational content,
 * and step-by-step navigation.
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
  SHADOW,
  SPACING,
} from "@/constants/theme";
import { useTour, type ElementLayout } from "./TourProvider";

const SPOTLIGHT_PADDING = 10;
const SPOTLIGHT_RADIUS = 14;
const TOOLTIP_WIDTH = 320;

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
  const tooltipSlide = useRef(new Animated.Value(30)).current;
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isActive && currentStep) {
      fadeAnim.setValue(0);
      tooltipSlide.setValue(30);

      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 350,
          useNativeDriver: true,
        }),
        Animated.timing(tooltipSlide, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
      ]).start();

      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1400,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 0,
            duration: 1400,
            useNativeDriver: true,
          }),
        ]),
      );
      pulse.start();

      const glow = Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: false,
          }),
          Animated.timing(glowAnim, {
            toValue: 0,
            duration: 800,
            useNativeDriver: false,
          }),
        ]),
      );
      glow.start();

      return () => {
        pulse.stop();
        glow.stop();
      };
    }
  }, [isActive, currentStep, currentStepIndex, fadeAnim, tooltipSlide, pulseAnim, glowAnim]);

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
        borderRadius: SPOTLIGHT_RADIUS,
      }
    : null;

  const tooltipPosition = computeTooltipPosition(
    targetLayout,
    currentStep.position,
    screenW,
    screenH,
  );

  const pulseScale = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.08],
  });

  const pulseOpacity = pulseAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.5, 1, 0.5],
  });

  const ringBorderColor = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [COLORS.primary, "#FFD700"],
  });

  return (
    <Animated.View
      style={[styles.overlay, { opacity: fadeAnim }]}
      pointerEvents="box-none"
    >
      {/* Dark backdrop */}
      <View style={styles.backdrop} pointerEvents="none" />

      {/* Spotlight cutout */}
      {spotlightStyle && (
        <>
          {/* Outer pulse ring */}
          <Animated.View
            style={[
              styles.spotlightOuter,
              spotlightStyle,
              {
                transform: [{ scale: pulseScale }],
                opacity: pulseOpacity,
                borderColor: ringBorderColor,
              },
            ]}
            pointerEvents="none"
          />
          {/* Inner bright ring */}
          <Animated.View
            style={[
              styles.spotlightRing,
              spotlightStyle,
              { borderColor: ringBorderColor },
            ]}
            pointerEvents="none"
          />
          {/* Transparent cutout */}
          <View
            style={[styles.spotlightCutout, spotlightStyle]}
            pointerEvents="none"
          />
        </>
      )}

      {/* Tooltip */}
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
        {/* Header: step counter + skip */}
        <View style={styles.tooltipHeader}>
          <View style={styles.stepBadge}>
            <Text style={styles.stepBadgeText}>
              Step {currentStepIndex + 1} of {totalSteps}
            </Text>
          </View>
          <Pressable onPress={skipTour} hitSlop={16}>
            <Text style={styles.skipText}>Skip Tour</Text>
          </Pressable>
        </View>

        {/* Title */}
        <Text style={styles.tooltipTitle}>{currentStep.title}</Text>

        {/* Scrollable description for longer text */}
        <ScrollView
          style={styles.descScroll}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.tooltipDesc}>{currentStep.description}</Text>
        </ScrollView>

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
          <Pressable style={styles.nextBtn} onPress={nextStep}>
            <Text style={styles.nextBtnText}>
              {isLastStep ? "Get Started" : "Next"}
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
  left = Math.max(12, Math.min(left, screenW - TOOLTIP_WIDTH - 12));

  const gap = SPOTLIGHT_PADDING + 12;
  const below = target.y + target.height + gap;
  const above = target.y - gap;
  const tooltipEstHeight = 260;

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
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.82)",
  },

  spotlightCutout: {
    position: "absolute",
    backgroundColor: "transparent",
    ...(Platform.OS === "web"
      ? {
          boxShadow: `0 0 0 9999px rgba(0,0,0,0.82), 0 0 30px ${COLORS.primary}, 0 0 60px rgba(255,106,42,0.3)`,
        }
      : {}),
  },
  spotlightRing: {
    position: "absolute",
    borderWidth: 3,
    borderColor: COLORS.primary,
    backgroundColor: "transparent",
  },
  spotlightOuter: {
    position: "absolute",
    borderWidth: 2,
    borderColor: COLORS.primary,
    backgroundColor: "transparent",
    margin: -6,
    padding: 6,
  },

  tooltip: {
    position: "absolute",
    width: TOOLTIP_WIDTH,
    backgroundColor: "#1A1A1E",
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: "rgba(255, 106, 42, 0.3)",
    borderTopWidth: 3,
    borderTopColor: COLORS.primary,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    ...SHADOW.glow,
    ...(Platform.OS === "web"
      ? {
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          boxShadow: `0 8px 32px rgba(0,0,0,0.6), 0 0 20px rgba(255,106,42,0.15)`,
        }
      : {}),
  },

  tooltipHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING.sm,
  },
  stepBadge: {
    backgroundColor: "rgba(255, 106, 42, 0.15)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.full,
  },
  stepBadgeText: {
    color: COLORS.primary,
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.bold,
    letterSpacing: 0.5,
  },
  skipText: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.medium,
    textDecorationLine: "underline",
  },

  tooltipTitle: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: FONT_WEIGHT.bold,
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  descScroll: {
    maxHeight: 120,
    marginBottom: SPACING.sm,
  },
  tooltipDesc: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.sm,
    lineHeight: 21,
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
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  dotActive: {
    width: 20,
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
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: BORDER_RADIUS.sm,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
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
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: BORDER_RADIUS.full,
    ...SHADOW.glow,
  },
  nextBtnText: {
    color: COLORS.white,
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.bold,
    letterSpacing: 0.3,
  },
});
