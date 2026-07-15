import React from "react";
import { Text, View } from "react-native";

import { useAuth } from "@/hooks/use-auth";
import type { ColorPalette } from "@/constants/theme";
import { useThemedStyles } from "@/hooks/use-themed-styles";
import { FONT_WEIGHT } from "@/constants/theme";

interface HeaderTitleProps {
  pageName: string;
}

export function HeaderTitle({ pageName }: HeaderTitleProps): React.JSX.Element {
  const { workspace } = useAuth();
  const styles = useThemedStyles(createStyles);
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

function createStyles(colors: ColorPalette) {
  return {
    container: {
      alignItems: "center" as const,
      justifyContent: "center" as const,
      paddingBottom: 6,
    },
    workspaceName: {
      fontSize: 48,
      fontWeight: FONT_WEIGHT.heavy,
      color: colors.textPrimary,
      letterSpacing: -1,
      textAlign: "center" as const,
      lineHeight: 54,
    },
    pageName: {
      fontSize: 14,
      fontWeight: FONT_WEIGHT.semibold,
      color: colors.primary,
      letterSpacing: 4,
      textTransform: "uppercase" as const,
      marginTop: 4,
      textAlign: "center" as const,
    },
    fallback: {
      fontSize: 48,
      fontWeight: FONT_WEIGHT.heavy,
      color: colors.textPrimary,
      letterSpacing: -1,
      textAlign: "center" as const,
    },
  };
}
