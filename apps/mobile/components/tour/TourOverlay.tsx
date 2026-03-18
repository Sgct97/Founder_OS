/**
 * TourOverlay — ultra-premium onboarding spotlight + tooltip.
 *
 * Full-screen dark backdrop with a glowing spotlight cutout,
 * and a large, soft, frosted-glass tooltip card with rich content.
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

import { COLORS, FONT_WEIGHT, SPACING } from "@/constants/theme";
import { useTour, type ElementLayout } from "./TourProvider";

const SPOTLIGHT_PADDING = 12;
const TOOLTIP_MAX_WIDTH = 420;

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
  const cardScale = useRef(new Animated.Value(0.95)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isActive && currentStep) {
      fadeAnim.setValue(0);
      cardScale.setValue(0.95);
      cardOpacity.setValue(0);

      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.spring(cardScale, {
          toValue: 1,
          tension: 60,
          friction: 9,
          useNativeDriver: true,
        }),
        Animated.timing(cardOpacity, {
          toValue: 1,
          duration: 500,
          delay: 100,
          useNativeDriver: true,
        }),
      ]).start();

      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1600,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 0,
            duration: 1600,
            useNativeDriver: true,
          }),
        ]),
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [isActive, currentStep, currentStepIndex, fadeAnim, cardScale, cardOpacity, pulseAnim]);

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

  const pulseScale = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.06],
  });

  const pulseOpacity = pulseAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.4, 0.9, 0.4],
  });

  const progressPercent = ((currentStepIndex + 1) / totalSteps) * 100;

  return (
    <Animated.View
      style={[styles.overlay, { opacity: fadeAnim }]}
      pointerEvents="box-none"
    >
      {/* Backdrop */}
      <View style={styles.backdrop} pointerEvents="none" />

      {/* Spotlight */}
      {spotlightStyle && (
        <>
          <Animated.View
            style={[
              styles.spotlightGlow,
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

      {/* Tooltip Card */}
      <Animated.View
        style={[
          styles.card,
          tooltipPosition,
          {
            opacity: cardOpacity,
            transform: [{ scale: cardScale }],
            maxWidth: Math.min(TOOLTIP_MAX_WIDTH, screenW - 32),
          },
        ]}
      >
        {/* Top accent gradient line */}
        <View style={styles.accentBar} />

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.stepIndicator}>
            <View style={styles.stepDot} />
            <Text style={styles.stepLabel}>
              {currentStepIndex + 1} / {totalSteps}
            </Text>
          </View>
          <Pressable onPress={skipTour} hitSlop={20} style={styles.skipBtn}>
            <Text style={styles.skipText}>Skip</Text>
            <Ionicons name="close" size={14} color="rgba(255,255,255,0.35)" />
          </Pressable>
        </View>

        {/* Title */}
        <Text style={styles.title}>{currentStep.title}</Text>

        {/* Description */}
        <ScrollView
          style={styles.descScroll}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.description}>{currentStep.description}</Text>
        </ScrollView>

        {/* Progress bar */}
        <View style={styles.progressTrack}>
          <View
            style={[styles.progressFill, { width: `${progressPercent}%` }]}
          />
        </View>

        {/* Navigation */}
        <View style={styles.navRow}>
          {!isFirstStep ? (
            <Pressable
              style={({ pressed }) => [
                styles.backBtn,
                pressed && styles.btnPressed,
              ]}
              onPress={prevStep}
            >
              <Ionicons
                name="arrow-back"
                size={16}
                color="rgba(255,255,255,0.6)"
              />
              <Text style={styles.backText}>Back</Text>
            </Pressable>
          ) : (
            <View />
          )}
          <Pressable
            style={({ pressed }) => [
              styles.nextBtn,
              pressed && styles.nextBtnPressed,
            ]}
            onPress={nextStep}
          >
            <Text style={styles.nextText}>
              {isLastStep ? "Get Started" : "Continue"}
            </Text>
            {!isLastStep && (
              <Ionicons name="arrow-forward" size={16} color="#fff" />
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
  const cardWidth = Math.min(TOOLTIP_MAX_WIDTH, screenW - 32);

  if (!target) {
    return {
      left: (screenW - cardWidth) / 2,
      top: screenH * 0.25,
    };
  }

  const centerX = target.x + target.width / 2;
  let left = centerX - cardWidth / 2;
  left = Math.max(16, Math.min(left, screenW - cardWidth - 16));

  const gap = SPOTLIGHT_PADDING + 16;
  const below = target.y + target.height + gap;
  const above = target.y - gap;
  const cardEstHeight = 320;

  if (preferredPosition === "bottom" && below + cardEstHeight < screenH - 90) {
    return { left, top: below };
  }
  if (preferredPosition === "top" && above - cardEstHeight > 10) {
    return { left, top: above - cardEstHeight };
  }
  if (below + cardEstHeight < screenH - 90) {
    return { left, top: below };
  }
  return { left, top: Math.max(20, above - cardEstHeight) };
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.80)",
  },

  spotlightCutout: {
    position: "absolute",
    backgroundColor: "transparent",
    borderWidth: 2,
    borderColor: "rgba(255, 106, 42, 0.6)",
    ...(Platform.OS === "web"
      ? {
          boxShadow: [
            "0 0 0 9999px rgba(0,0,0,0.80)",
            "0 0 40px rgba(255,106,42,0.4)",
            "0 0 80px rgba(255,106,42,0.15)",
            "inset 0 0 20px rgba(255,106,42,0.08)",
          ].join(", "),
        }
      : {}),
  },
  spotlightGlow: {
    position: "absolute",
    borderWidth: 2,
    borderColor: "rgba(255, 165, 80, 0.5)",
    backgroundColor: "transparent",
    margin: -8,
    padding: 8,
    borderRadius: 22,
  },

  card: {
    position: "absolute",
    width: TOOLTIP_MAX_WIDTH,
    backgroundColor: "rgba(22, 22, 26, 0.95)",
    borderRadius: 24,
    overflow: "hidden",
    paddingTop: 0,
    paddingHorizontal: 28,
    paddingBottom: 24,
    ...(Platform.OS === "web"
      ? {
          backdropFilter: "blur(40px) saturate(180%)",
          WebkitBackdropFilter: "blur(40px) saturate(180%)",
          boxShadow: [
            "0 24px 80px rgba(0,0,0,0.5)",
            "0 0 1px rgba(255,255,255,0.08)",
            "0 0 40px rgba(255,106,42,0.06)",
          ].join(", "),
        }
      : {
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 16 },
          shadowOpacity: 0.5,
          shadowRadius: 40,
          elevation: 24,
        }),
  },

  accentBar: {
    height: 3,
    marginHorizontal: -28,
    marginBottom: 20,
    backgroundColor: COLORS.primary,
    ...(Platform.OS === "web"
      ? {
          background: `linear-gradient(90deg, ${COLORS.primary}, #FFB366, ${COLORS.primary})`,
        }
      : {}),
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  stepIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
  },
  stepLabel: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 13,
    fontWeight: FONT_WEIGHT.semibold,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  skipBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  skipText: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 12,
    fontWeight: FONT_WEIGHT.medium,
  },

  title: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: -0.4,
    lineHeight: 28,
    marginBottom: 12,
  },

  descScroll: {
    maxHeight: 130,
    marginBottom: 20,
  },
  description: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 15,
    lineHeight: 24,
    letterSpacing: 0.1,
  },

  progressTrack: {
    height: 3,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 2,
    marginBottom: 20,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 2,
    backgroundColor: COLORS.primary,
    ...(Platform.OS === "web"
      ? {
          background: `linear-gradient(90deg, ${COLORS.primary}, #FFB366)`,
          transition: "width 0.4s ease",
        }
      : {}),
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
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  backText: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 14,
    fontWeight: FONT_WEIGHT.semibold,
  },
  nextBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    ...(Platform.OS === "web"
      ? {
          boxShadow: "0 4px 20px rgba(255,106,42,0.35), 0 1px 3px rgba(0,0,0,0.2)",
          transition: "transform 0.15s ease, box-shadow 0.15s ease",
        }
      : {
          shadowColor: COLORS.primary,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.4,
          shadowRadius: 12,
        }),
  },
  nextBtnPressed: {
    opacity: 0.9,
    ...(Platform.OS === "web"
      ? { transform: [{ scale: 0.97 }] }
      : {}),
  },
  btnPressed: {
    opacity: 0.7,
  },
  nextText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
});
