/**
 * Unit tests for invite signup → join flow.
 * Ensures a session is required and the join API is called with the new user.
 */

const mockSignUp = jest.fn();
const mockApiPost = jest.fn();
const mockSetAccessToken = jest.fn();

jest.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: {
      signUp: (...args: unknown[]) => mockSignUp(...args),
    },
  }),
}));

jest.mock("@/services/api", () => ({
  apiPost: (...args: unknown[]) => mockApiPost(...args),
  apiGet: jest.fn(),
  setAccessToken: (...args: unknown[]) => mockSetAccessToken(...args),
  clearAccessToken: jest.fn(),
}));

describe("signUpAndJoin", () => {
  const originalUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const originalKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  beforeEach(() => {
    jest.resetModules();
    mockSignUp.mockReset();
    mockApiPost.mockReset();
    mockSetAccessToken.mockReset();
    process.env.EXPO_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
  });

  afterAll(() => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = originalUrl;
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = originalKey;
  });

  it("stores the session token and joins the workspace", async () => {
    mockSignUp.mockResolvedValue({
      data: {
        session: { access_token: "tok-123" },
        user: { id: "uid-abc" },
      },
      error: null,
    });
    mockApiPost.mockResolvedValue({
      user: { id: "db-1", email: "a@b.com" },
      workspace: { id: "ws-1", name: "Acme" },
    });

    const { signUpAndJoin } = await import("../auth");
    const result = await signUpAndJoin(
      "ABCD1234",
      "a@b.com",
      "secret12",
      "Alex"
    );

    expect(mockSetAccessToken).toHaveBeenCalledWith("tok-123");
    expect(mockApiPost).toHaveBeenCalledWith("/api/v1/auth/join", {
      invite_code: "ABCD1234",
      email: "a@b.com",
      display_name: "Alex",
      supabase_uid: "uid-abc",
    });
    expect(result.workspace?.id).toBe("ws-1");
  });

  it("fails when Supabase returns no session", async () => {
    mockSignUp.mockResolvedValue({
      data: { session: null, user: { id: "uid-abc" } },
      error: null,
    });

    const { signUpAndJoin } = await import("../auth");
    await expect(
      signUpAndJoin("ABCD1234", "a@b.com", "secret12", "Alex")
    ).rejects.toThrow(/no session/i);
    expect(mockApiPost).not.toHaveBeenCalled();
  });
});
