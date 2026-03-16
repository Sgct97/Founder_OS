import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { useAuth } from "@/hooks/use-auth";
import { COLORS, FONT_WEIGHT } from "@/constants/theme";

interface HeaderTitleProps {
  pageName: string;
}

export function HeaderTitle({ pageName }: HeaderTitleProps): React.JSX.Element {
  const { workspace } = useAuth();
  const wsName = workspace?.name;

  if (!wsName) {
    return <Text style={styles.fallback}>{pageName}</Text>;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.workspaceName} numberOfLines={1}>
        {wsName}
      </Text>
      <Text style={styles.pageName}>{pageName}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 6,
  },
  workspaceName: {
    fontSize: 48,
    fontWeight: FONT_WEIGHT.heavy,
    color: COLORS.white,
    letterSpacing: -1,
    textAlign: "center",
    lineHeight: 54,
  },
  pageName: {
    fontSize: 14,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.primary,
    letterSpacing: 4,
    textTransform: "uppercase",
    marginTop: 4,
    textAlign: "center",
  },
  fallback: {
    fontSize: 48,
    fontWeight: FONT_WEIGHT.heavy,
    color: COLORS.white,
    letterSpacing: -1,
    textAlign: "center",
  },
});
