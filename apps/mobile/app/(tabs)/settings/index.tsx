/**
 * Settings screen — profile, workspace, integrations, project brief, sign out.
 */

import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAuth } from "@/hooks/use-auth";
import {
  useApiKeys,
  useAddApiKey,
  useDeleteApiKey,
  useProjectBrief,
  useUpdateProjectBrief,
} from "@/hooks/use-workspace-settings";
import {
  useWorkspaces,
  useCreateWorkspace,
  useSwitchWorkspace,
  useJoinWorkspace,
  useRenameWorkspace,
} from "@/hooks/use-workspaces";
import {
  BORDER_RADIUS,
  COLORS,
  FONT_SIZE,
  FONT_WEIGHT,
  LAYOUT,
  SHADOW,
  SPACING,
} from "@/constants/theme";

const SUPPORTED_SERVICES = [
  { id: "openai", label: "OpenAI", placeholder: "sk-..." },
  { id: "anthropic", label: "Anthropic", placeholder: "sk-ant-..." },
] as const;

export default function SettingsScreen() {
  const { user, workspace, isLoading, signOut, setWorkspace } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  // API Keys state
  const { data: apiKeys, isLoading: keysLoading } = useApiKeys();
  const addKeyMutation = useAddApiKey();
  const deleteKeyMutation = useDeleteApiKey();
  const [addingService, setAddingService] = useState<string | null>(null);
  const [newKeyValue, setNewKeyValue] = useState("");
  const [newKeyLabel, setNewKeyLabel] = useState("");

  // Project Brief state
  const { data: briefData, isLoading: briefLoading } = useProjectBrief();
  const updateBriefMutation = useUpdateProjectBrief();
  const [editingBrief, setEditingBrief] = useState(false);
  const [briefDraft, setBriefDraft] = useState("");

  // Workspace switcher state
  const queryClient = useQueryClient();
  const { data: workspaces, isLoading: workspacesLoading } = useWorkspaces();
  const createWorkspaceMutation = useCreateWorkspace();
  const switchWorkspaceMutation = useSwitchWorkspace();
  const joinWorkspaceMutation = useJoinWorkspace();
  const renameWorkspaceMutation = useRenameWorkspace();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [joinInviteCode, setJoinInviteCode] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");

  const handleSwitchWorkspace = useCallback(
    async (workspaceId: string) => {
      try {
        await switchWorkspaceMutation.mutateAsync(workspaceId);
        queryClient.clear();
        window?.location?.reload?.();
      } catch (e: any) {
        Alert.alert("Error", e.detail || e.message || "Failed to switch");
      }
    },
    [switchWorkspaceMutation, queryClient]
  );

  const handleCreateWorkspace = useCallback(async () => {
    const name = newWorkspaceName.trim();
    if (!name) return;
    try {
      await createWorkspaceMutation.mutateAsync(name);
      setShowCreateModal(false);
      setNewWorkspaceName("");
      queryClient.clear();
      window?.location?.reload?.();
    } catch (e: any) {
      Alert.alert("Error", e.detail || e.message || "Failed to create workspace");
    }
  }, [newWorkspaceName, createWorkspaceMutation, queryClient]);

  const handleJoinWorkspace = useCallback(async () => {
    const code = joinInviteCode.trim();
    if (!code) return;
    try {
      await joinWorkspaceMutation.mutateAsync(code);
      setShowJoinModal(false);
      setJoinInviteCode("");
      queryClient.clear();
      window?.location?.reload?.();
    } catch (e: any) {
      Alert.alert("Error", e.detail || e.message || "Failed to join workspace");
    }
  }, [joinInviteCode, joinWorkspaceMutation, queryClient]);

  const handleStartEditName = useCallback(() => {
    setNameDraft(workspace?.name ?? "");
    setEditingName(true);
  }, [workspace]);

  const handleSaveName = useCallback(async () => {
    const trimmed = nameDraft.trim();
    if (!trimmed || trimmed === workspace?.name) {
      setEditingName(false);
      return;
    }
    try {
      const updated = await renameWorkspaceMutation.mutateAsync(trimmed);
      setWorkspace(updated);
      setEditingName(false);
    } catch (e: any) {
      const msg = e?.detail || e?.message || "Failed to rename workspace";
      if (Platform.OS === "web") {
        window.alert(msg);
      } else {
        Alert.alert("Error", msg);
      }
    }
  }, [nameDraft, workspace, renameWorkspaceMutation, setWorkspace]);

  const handleSignOut = useCallback(async () => {
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      setSigningOut(false);
    }
  }, [signOut]);

  const [copiedInvite, setCopiedInvite] = useState(false);

  const handleCopyInvite = useCallback(() => {
    if (!workspace?.invite_code) return;
    if (Platform.OS === "web") {
      navigator.clipboard.writeText(workspace.invite_code).then(() => {
        setCopiedInvite(true);
        setTimeout(() => setCopiedInvite(false), 2000);
      });
    } else {
      Alert.alert("Invite Code", workspace.invite_code, [{ text: "OK" }]);
    }
  }, [workspace]);

  const handleAddKey = useCallback(async () => {
    if (!addingService || !newKeyValue.trim()) return;
    try {
      await addKeyMutation.mutateAsync({
        service: addingService,
        api_key: newKeyValue.trim(),
        label: newKeyLabel.trim() || undefined,
      });
      setAddingService(null);
      setNewKeyValue("");
      setNewKeyLabel("");
    } catch (e: any) {
      Alert.alert("Error", e.detail || e.message || "Failed to add key");
    }
  }, [addingService, newKeyValue, newKeyLabel, addKeyMutation]);

  const handleDeleteKey = useCallback(
    (keyId: string, service: string) => {
      const doDelete = () => deleteKeyMutation.mutate(keyId);

      if (Platform.OS === "web") {
        if (window.confirm(`Remove ${service} API key?`)) doDelete();
      } else {
        Alert.alert(
          "Remove Key",
          `Remove ${service} API key from this workspace?`,
          [
            { text: "Cancel", style: "cancel" },
            { text: "Remove", style: "destructive", onPress: doDelete },
          ]
        );
      }
    },
    [deleteKeyMutation]
  );

  const handleStartEditBrief = useCallback(() => {
    setBriefDraft(briefData?.project_brief || "");
    setEditingBrief(true);
  }, [briefData]);

  const handleSaveBrief = useCallback(async () => {
    try {
      await updateBriefMutation.mutateAsync(briefDraft.trim() || null);
      setEditingBrief(false);
    } catch (e: any) {
      Alert.alert("Error", e.detail || e.message || "Failed to save");
    }
  }, [briefDraft, updateBriefMutation]);

  const initials = user?.display_name
    ? user.display_name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?";

  if (isLoading) {
    return (
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <View style={styles.profileRow}>
            <Skeleton width={48} height={48} borderRadius={BORDER_RADIUS.full} />
            <View style={{ flex: 1, marginLeft: SPACING.md }}>
              <Skeleton width="60%" height={16} />
              <Skeleton width="80%" height={12} style={{ marginTop: 8 }} />
            </View>
          </View>
        </View>
        <View style={styles.card}>
          <Skeleton width={80} height={10} style={{ marginBottom: SPACING.md }} />
          <Skeleton width="100%" height={36} style={{ marginBottom: SPACING.sm }} />
          <Skeleton width="100%" height={36} style={{ marginBottom: SPACING.sm }} />
          <Skeleton width="100%" height={36} />
        </View>
      </ScrollView>
    );
  }

  const configuredServices = new Set(apiKeys?.map((k) => k.service) || []);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Profile Card ──────────────────────────────── */}
      <View style={styles.card}>
        <View style={styles.profileRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{user?.display_name}</Text>
            <Text style={styles.profileEmail}>{user?.email}</Text>
          </View>
        </View>
      </View>

      {/* ── Workspace Card ────────────────────────────── */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Workspace</Text>
        {editingName ? (
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Name</Text>
            <View style={styles.editNameRow}>
              <TextInput
                style={styles.editNameInput}
                value={nameDraft}
                onChangeText={setNameDraft}
                autoFocus
                maxLength={100}
                placeholderTextColor={COLORS.textMuted}
                onSubmitEditing={handleSaveName}
                returnKeyType="done"
              />
              <Pressable onPress={handleSaveName} style={styles.editNameSaveBtn}>
                {renameWorkspaceMutation.isPending ? (
                  <ActivityIndicator size="small" color={COLORS.primary} />
                ) : (
                  <Ionicons name="checkmark" size={18} color={COLORS.primary} />
                )}
              </Pressable>
              <Pressable onPress={() => setEditingName(false)} style={styles.editNameCancelBtn}>
                <Ionicons name="close" size={18} color={COLORS.textMuted} />
              </Pressable>
            </View>
          </View>
        ) : (
          <Pressable
            style={styles.row}
            onPress={handleStartEditName}
            // @ts-ignore
            title="Click to rename this workspace"
          >
            <Text style={styles.rowLabel}>Name</Text>
            <View style={styles.editableValue}>
              <Text style={styles.rowValue}>{workspace?.name ?? "—"}</Text>
              <Ionicons name="pencil-outline" size={14} color={COLORS.textMuted} style={{ marginLeft: 6 }} />
            </View>
          </Pressable>
        )}
        <View style={styles.divider} />
        <Pressable
          style={styles.row}
          onPress={handleCopyInvite}
          accessibilityLabel="Copy invite code"
          // @ts-ignore
          title="Click to copy invite code — share with teammates so they can join"
        >
          <Text style={styles.rowLabel}>Invite Code</Text>
          <View style={styles.codeBadge}>
            <Text style={styles.codeText}>
              {copiedInvite ? "Copied!" : (workspace?.invite_code ?? "—")}
            </Text>
            <Ionicons
              name={copiedInvite ? "checkmark" : "copy-outline"}
              size={14}
              color={copiedInvite ? COLORS.success : COLORS.primary}
              style={styles.copyIcon}
            />
          </View>
        </Pressable>
        <View style={styles.divider} />
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Daily Commitment</Text>
          <Text style={styles.rowValue}>
            {workspace?.commitment_hours
              ? `${workspace.commitment_hours}h / day`
              : "Not set"}
          </Text>
        </View>
      </View>

      {/* ── Workspace Switcher Card ─────────────────── */}
      <View style={styles.card}>
        <View style={styles.sectionHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionTitle}>Your Workspaces</Text>
            <Text style={styles.sectionSubtitle}>
              Switch between workspaces, join one, or create a new one.
            </Text>
          </View>
          <View style={styles.wsActionBtns}>
            <Pressable
              style={styles.addWorkspaceBtn}
              onPress={() => setShowJoinModal(true)}
              // @ts-ignore — React Native Web passes title as HTML title attr
              title="Join a workspace using an invite code"
              accessibilityLabel="Join workspace"
            >
              <Ionicons name="enter-outline" size={14} color={COLORS.primary} />
              <Text style={styles.wsActionLabel}>Join</Text>
            </Pressable>
            <Pressable
              style={styles.addWorkspaceBtn}
              onPress={() => setShowCreateModal(true)}
              // @ts-ignore — React Native Web passes title as HTML title attr
              title="Create a brand new workspace"
              accessibilityLabel="Create workspace"
            >
              <Ionicons name="add" size={15} color={COLORS.primary} />
              <Text style={styles.wsActionLabel}>Create</Text>
            </Pressable>
          </View>
        </View>

        {workspacesLoading ? (
          <>
            <Skeleton width="100%" height={48} style={{ marginBottom: SPACING.sm }} />
            <Skeleton width="100%" height={48} />
          </>
        ) : (
          workspaces?.map((ws) => (
            <Pressable
              key={ws.id}
              style={[
                styles.workspaceRow,
                ws.is_active && styles.workspaceRowActive,
              ]}
              onPress={() => {
                if (!ws.is_active) handleSwitchWorkspace(ws.id);
              }}
              disabled={switchWorkspaceMutation.isPending}
              // @ts-ignore
              title={ws.is_active ? "Currently active workspace" : `Switch to ${ws.name}`}
            >
              <View style={[styles.wsIconWrap, ws.is_active && styles.wsIconWrapActive]}>
                <Text style={[styles.wsIconText, ws.is_active && styles.wsIconTextActive]}>
                  {ws.name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.wsInfo}>
                <Text style={[styles.wsName, ws.is_active && styles.wsNameActive]}>
                  {ws.name}
                </Text>
                <Text style={styles.wsRole}>{ws.role}</Text>
              </View>
              {ws.is_active && (
                <View style={styles.wsActiveBadge}>
                  <Ionicons name="checkmark-circle" size={16} color={COLORS.success} />
                  <Text style={styles.wsActiveText}>Active</Text>
                </View>
              )}
              {!ws.is_active && (
                <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
              )}
            </Pressable>
          ))
        )}
      </View>

      {/* Create Workspace Modal */}
      <Modal
        visible={showCreateModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCreateModal(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowCreateModal(false)}
        >
          <View style={styles.modalSheet}>
            <Pressable onPress={() => {}}>
              <Text style={styles.modalTitle}>Create New Workspace</Text>
              <Text style={styles.modalSubtitle}>
                Start a fresh workspace for a new project or team.
              </Text>
              <TextInput
                style={styles.modalInput}
                value={newWorkspaceName}
                onChangeText={setNewWorkspaceName}
                placeholder="Workspace name"
                placeholderTextColor={COLORS.textMuted}
                autoFocus
                maxLength={100}
              />
              <View style={styles.modalActions}>
                <Pressable
                  style={styles.modalCancelBtn}
                  onPress={() => {
                    setShowCreateModal(false);
                    setNewWorkspaceName("");
                  }}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.modalCreateBtn,
                    !newWorkspaceName.trim() && styles.modalCreateBtnDisabled,
                  ]}
                  onPress={handleCreateWorkspace}
                  disabled={!newWorkspaceName.trim() || createWorkspaceMutation.isPending}
                >
                  {createWorkspaceMutation.isPending ? (
                    <ActivityIndicator size="small" color={COLORS.white} />
                  ) : (
                    <Text style={styles.modalCreateText}>Create</Text>
                  )}
                </Pressable>
              </View>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* Join Workspace Modal */}
      <Modal
        visible={showJoinModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowJoinModal(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowJoinModal(false)}
        >
          <View style={styles.modalSheet}>
            <Pressable onPress={() => {}}>
              <Text style={styles.modalTitle}>Join a Workspace</Text>
              <Text style={styles.modalSubtitle}>
                Enter the invite code shared by the workspace owner.
              </Text>
              <TextInput
                style={[styles.modalInput, { textTransform: "uppercase", letterSpacing: 2 }]}
                value={joinInviteCode}
                onChangeText={setJoinInviteCode}
                placeholder="e.g. A7KX3BN2"
                placeholderTextColor={COLORS.textMuted}
                autoFocus
                maxLength={20}
                autoCapitalize="characters"
              />
              <View style={styles.modalActions}>
                <Pressable
                  style={styles.modalCancelBtn}
                  onPress={() => {
                    setShowJoinModal(false);
                    setJoinInviteCode("");
                  }}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.modalCreateBtn,
                    !joinInviteCode.trim() && styles.modalCreateBtnDisabled,
                  ]}
                  onPress={handleJoinWorkspace}
                  disabled={!joinInviteCode.trim() || joinWorkspaceMutation.isPending}
                >
                  {joinWorkspaceMutation.isPending ? (
                    <ActivityIndicator size="small" color={COLORS.white} />
                  ) : (
                    <Text style={styles.modalCreateText}>Join</Text>
                  )}
                </Pressable>
              </View>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* ── Integrations Card ────────────────────────── */}
      <View style={styles.card}>
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>Integrations</Text>
            <Text style={styles.sectionSubtitle}>
              API keys are encrypted with AES-256-GCM and never leave the server.
            </Text>
          </View>
          <Ionicons name="shield-checkmark" size={18} color={COLORS.success} />
        </View>

        {keysLoading ? (
          <>
            <Skeleton width="100%" height={44} style={{ marginBottom: SPACING.sm }} />
            <Skeleton width="100%" height={44} />
          </>
        ) : (
          <>
            {/* Existing keys */}
            {apiKeys?.map((key) => (
              <View key={key.id} style={styles.keyRow}>
                <View style={styles.keyInfo}>
                  <Text style={styles.keyService}>{key.service.toUpperCase()}</Text>
                  <Text style={styles.keyHint}>{key.key_hint}</Text>
                  {key.label && (
                    <Text style={styles.keyLabel}>{key.label}</Text>
                  )}
                </View>
                <Pressable
                  onPress={() => handleDeleteKey(key.id, key.service)}
                  hitSlop={12}
                  // @ts-ignore
                  title="Remove this API key"
                >
                  <Ionicons name="trash-outline" size={18} color={COLORS.error} />
                </Pressable>
              </View>
            ))}

            {/* Add key form */}
            {addingService ? (
              <View style={styles.addKeyForm}>
                <Text style={styles.addKeyFormTitle}>
                  Add {SUPPORTED_SERVICES.find((s) => s.id === addingService)?.label} Key
                </Text>
                <TextInput
                  style={styles.textInput}
                  placeholder={
                    SUPPORTED_SERVICES.find((s) => s.id === addingService)
                      ?.placeholder || "Enter API key"
                  }
                  placeholderTextColor={COLORS.textMuted}
                  value={newKeyValue}
                  onChangeText={setNewKeyValue}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TextInput
                  style={styles.textInput}
                  placeholder="Label (optional, e.g. 'Production')"
                  placeholderTextColor={COLORS.textMuted}
                  value={newKeyLabel}
                  onChangeText={setNewKeyLabel}
                  autoCapitalize="none"
                />
                <View style={styles.addKeyActions}>
                  <Button
                    label="Cancel"
                    variant="ghost"
                    onPress={() => {
                      setAddingService(null);
                      setNewKeyValue("");
                      setNewKeyLabel("");
                    }}
                    fullWidth={false}
                  />
                  <Button
                    label="Save Key"
                    onPress={handleAddKey}
                    loading={addKeyMutation.isPending}
                    disabled={!newKeyValue.trim()}
                    fullWidth={false}
                  />
                </View>
              </View>
            ) : (
              <View style={styles.addKeyButtons}>
                {SUPPORTED_SERVICES.filter(
                  (s) => !configuredServices.has(s.id)
                ).map((service) => (
                  <Pressable
                    key={service.id}
                    style={styles.addKeyButton}
                    onPress={() => setAddingService(service.id)}
                  >
                    <Ionicons
                      name="add-circle-outline"
                      size={18}
                      color={COLORS.primary}
                    />
                    <Text style={styles.addKeyButtonText}>
                      Add {service.label} Key
                    </Text>
                  </Pressable>
                ))}
                {SUPPORTED_SERVICES.every((s) =>
                  configuredServices.has(s.id)
                ) && (
                  <Text style={styles.allConfigured}>
                    All integrations configured
                  </Text>
                )}
              </View>
            )}
          </>
        )}
      </View>

      {/* ── Project Brief Card ───────────────────────── */}
      <View style={styles.card}>
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>Project Brief</Text>
            <Text style={styles.sectionSubtitle}>
              Describe your project so the AI assistant understands your context.
            </Text>
          </View>
          <Ionicons name="document-text-outline" size={18} color={COLORS.primary} />
        </View>

        {briefLoading ? (
          <Skeleton width="100%" height={80} />
        ) : editingBrief ? (
          <View>
            <TextInput
              style={[styles.textInput, styles.briefInput]}
              placeholder="Describe your project, its goals, tech stack, business model, target audience..."
              placeholderTextColor={COLORS.textMuted}
              value={briefDraft}
              onChangeText={setBriefDraft}
              multiline
              numberOfLines={8}
              textAlignVertical="top"
            />
            <Text style={styles.charCount}>
              {briefDraft.length.toLocaleString()} / 50,000 characters
            </Text>
            <View style={styles.addKeyActions}>
              <Button
                label="Cancel"
                variant="ghost"
                onPress={() => setEditingBrief(false)}
                fullWidth={false}
              />
              <Button
                label="Save Brief"
                onPress={handleSaveBrief}
                loading={updateBriefMutation.isPending}
                fullWidth={false}
              />
            </View>
          </View>
        ) : briefData?.project_brief ? (
          <View>
            <Text style={styles.briefPreview} numberOfLines={6}>
              {briefData.project_brief}
            </Text>
            <Pressable style={styles.editBriefButton} onPress={handleStartEditBrief}>
              <Ionicons name="create-outline" size={16} color={COLORS.primary} />
              <Text style={styles.editBriefText}>Edit Brief</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable style={styles.emptyBrief} onPress={handleStartEditBrief}>
            <Ionicons
              name="add-circle-outline"
              size={24}
              color={COLORS.textTertiary}
            />
            <Text style={styles.emptyBriefText}>
              Add a project brief to give the AI assistant context about what you're building.
            </Text>
          </Pressable>
        )}
      </View>

      {/* ── Actions ───────────────────────────────────── */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Account</Text>
        <Button
          label="Sign Out"
          onPress={handleSignOut}
          variant="danger"
          loading={signingOut}
        />
      </View>

      <Text style={styles.versionText}>FoundersForge v0.1.0</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    paddingHorizontal: LAYOUT.screenPaddingH,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.xxxl,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    ...SHADOW.sm,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
    maxWidth: "90%",
  },
  profileRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.primaryMuted,
    alignItems: "center",
    justifyContent: "center",
    marginRight: SPACING.md,
  },
  avatarText: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.primary,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  profileEmail: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textTertiary,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: SPACING.sm,
  },
  rowLabel: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    fontWeight: FONT_WEIGHT.medium,
  },
  rowValue: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textPrimary,
    fontWeight: FONT_WEIGHT.semibold,
  },
  editableValue: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
  },
  editNameRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 6,
    flex: 1,
    maxWidth: 220,
  },
  editNameInput: {
    flex: 1,
    fontSize: FONT_SIZE.sm,
    color: COLORS.textPrimary,
    fontWeight: FONT_WEIGHT.semibold,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.primary,
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  editNameSaveBtn: {
    padding: 4,
  },
  editNameCancelBtn: {
    padding: 4,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.divider,
  },
  codeBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.primaryMuted,
    borderRadius: BORDER_RADIUS.sm,
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: SPACING.xs,
  },
  codeText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.primary,
    letterSpacing: 1.2,
  },
  copyIcon: {
    marginLeft: SPACING.xs,
  },

  // ── Integrations ────────────────────────────────
  keyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  keyInfo: {
    flex: 1,
  },
  keyService: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.primary,
    letterSpacing: 1,
    marginBottom: 2,
  },
  keyHint: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  keyLabel: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  addKeyButtons: {
    gap: SPACING.sm,
  },
  addKeyButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    paddingVertical: SPACING.sm,
  },
  addKeyButtonText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.primary,
    fontWeight: FONT_WEIGHT.medium,
  },
  allConfigured: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.success,
    fontWeight: FONT_WEIGHT.medium,
    textAlign: "center",
    paddingVertical: SPACING.sm,
  },
  addKeyForm: {
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  addKeyFormTitle: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.textPrimary,
    marginBottom: SPACING.md,
  },
  addKeyActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  textInput: {
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    fontSize: FONT_SIZE.sm,
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
  },

  // ── Project Brief ──────────────────────────────
  briefInput: {
    minHeight: 160,
    textAlignVertical: "top",
    paddingTop: SPACING.sm + 2,
  },
  charCount: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
    textAlign: "right",
  },
  briefPreview: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    lineHeight: 20,
    marginBottom: SPACING.sm,
  },
  editBriefButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
    paddingVertical: SPACING.xs,
  },
  editBriefText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.primary,
    fontWeight: FONT_WEIGHT.medium,
  },
  emptyBrief: {
    alignItems: "center",
    paddingVertical: SPACING.lg,
    gap: SPACING.sm,
  },
  emptyBriefText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textTertiary,
    textAlign: "center",
    maxWidth: "80%",
    lineHeight: 20,
  },

  // ── Workspace Switcher ──────────────────────────
  wsActionBtns: {
    flexDirection: "row",
    gap: SPACING.xs,
  },
  addWorkspaceBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    height: 30,
    paddingHorizontal: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.primaryMuted,
    justifyContent: "center",
  },
  wsActionLabel: {
    fontSize: 12,
    fontWeight: "600" as const,
    color: COLORS.primary,
    letterSpacing: 0.3,
  },
  workspaceRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: SPACING.sm + 2,
    paddingHorizontal: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.xs,
  },
  workspaceRowActive: {
    backgroundColor: COLORS.primaryMuted,
  },
  wsIconWrap: {
    width: 36,
    height: 36,
    borderRadius: BORDER_RADIUS.sm,
    backgroundColor: COLORS.backgroundSubtle,
    alignItems: "center",
    justifyContent: "center",
    marginRight: SPACING.md,
  },
  wsIconWrapActive: {
    backgroundColor: COLORS.primary,
  },
  wsIconText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.textSecondary,
  },
  wsIconTextActive: {
    color: COLORS.white,
  },
  wsInfo: {
    flex: 1,
  },
  wsName: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.medium,
    color: COLORS.textPrimary,
  },
  wsNameActive: {
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.primary,
  },
  wsRole: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
    marginTop: 1,
  },
  wsActiveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xxs,
  },
  wsActiveText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.success,
    fontWeight: FONT_WEIGHT.medium,
  },

  // ── Create Workspace Modal ────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: SPACING.xl,
  },
  modalSheet: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.xl,
    width: "100%",
    maxWidth: 400,
    ...SHADOW.lg,
  },
  modalTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs,
  },
  modalSubtitle: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.lg,
    lineHeight: 20,
  },
  modalInput: {
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    fontSize: FONT_SIZE.sm,
    color: COLORS.textPrimary,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: SPACING.sm,
    marginTop: SPACING.lg,
  },
  modalCancelBtn: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm + 2,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.backgroundSubtle,
  },
  modalCancelText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.medium,
    color: COLORS.textSecondary,
  },
  modalCreateBtn: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm + 2,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.primary,
  },
  modalCreateBtnDisabled: {
    opacity: 0.5,
  },
  modalCreateText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.white,
  },

  versionText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
    textAlign: "center",
    marginTop: SPACING.lg,
  },
});
