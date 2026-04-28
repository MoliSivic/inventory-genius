import { createClient, type EmailOtpType, type User } from "@supabase/supabase-js";

const ENABLE_SUPABASE_AUTH = import.meta.env.VITE_ENABLE_SUPABASE_AUTH as string | undefined;
const ENABLE_SUPABASE_DATA_SYNC = import.meta.env.VITE_ENABLE_SUPABASE_DATA_SYNC as
  | string
  | undefined;
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const APP_URL = import.meta.env.VITE_APP_URL as string | undefined;

export const isSupabaseAuthEnabled = ENABLE_SUPABASE_AUTH === "true";
export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
export const isSupabaseReady = isSupabaseAuthEnabled && isSupabaseConfigured;
export const isSupabaseDataSyncEnabled = ENABLE_SUPABASE_DATA_SYNC === "true";
export const isSupabaseDataSyncReady = isSupabaseDataSyncEnabled && isSupabaseConfigured;
export const isMockAuthEnabled = !isSupabaseAuthEnabled;

export const MOCK_AUTH_DEMO_EMAIL = "admin@gmail.com";
export const MOCK_AUTH_DEMO_NAME = "Admin";
export const MOCK_AUTH_DEMO_PASSWORD = "admin123";
export const MOCK_AUTH_STORAGE_KEY = "inventory_genius_mock_auth_email";
export const MOCK_AUTH_STATE_CHANGED_EVENT = "inventory-genius:mock-auth-state-changed";

export type MockAuthUser = {
  email: string;
  name?: string;
};

export type AppRole = "admin" | "customer";

export type SupabaseUserProfile = {
  userId: string;
  email: string;
  fullName?: string;
  role: AppRole;
};

export const SUPABASE_AUTH_DISABLED_MESSAGE =
  "Supabase auth is disabled. Set VITE_ENABLE_SUPABASE_AUTH=true to enable it.";
export const SUPABASE_NOT_CONFIGURED_MESSAGE =
  "Supabase auth is enabled but not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.";
export const SUPABASE_DATA_SYNC_NOT_CONFIGURED_MESSAGE =
  "Supabase data sync is enabled but not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.";

export function getSupabaseUnavailableMessage() {
  if (!isSupabaseAuthEnabled) return SUPABASE_AUTH_DISABLED_MESSAGE;
  if (!isSupabaseConfigured) return SUPABASE_NOT_CONFIGURED_MESSAGE;
  return "";
}

function notifyMockAuthStateChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(MOCK_AUTH_STATE_CHANGED_EVENT));
}

export function getMockAuthEmail() {
  return getMockAuthUser()?.email ?? null;
}

export function getMockAuthName() {
  return getMockAuthUser()?.name ?? null;
}

function parseMockAuthUser(rawValue: string | null): MockAuthUser | null {
  if (!rawValue) return null;

  // Backward-compatible with previous storage format that saved only email as plain text.
  if (!rawValue.startsWith("{")) {
    return { email: rawValue };
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<MockAuthUser>;

    if (typeof parsed.email !== "string" || !parsed.email.trim()) {
      return null;
    }

    return {
      email: parsed.email,
      name: typeof parsed.name === "string" && parsed.name.trim() ? parsed.name : undefined,
    };
  } catch {
    return null;
  }
}

export function getMockAuthUser() {
  if (typeof window === "undefined") return null;
  return parseMockAuthUser(window.localStorage.getItem(MOCK_AUTH_STORAGE_KEY));
}

export function signInWithMockCredentials(email: string, password: string) {
  if (!isMockAuthEnabled) {
    return { ok: false as const, message: "Mock auth is disabled." };
  }

  const normalizedEmail = email.trim().toLowerCase();
  const normalizedPassword = password.trim();

  if (
    normalizedEmail !== MOCK_AUTH_DEMO_EMAIL.toLowerCase() ||
    normalizedPassword !== MOCK_AUTH_DEMO_PASSWORD
  ) {
    return {
      ok: false as const,
      message: "Invalid mock credentials. Use admin@gmail.com and admin123.",
    };
  }

  if (typeof window !== "undefined") {
    const mockUser: MockAuthUser = {
      email: MOCK_AUTH_DEMO_EMAIL,
      name: MOCK_AUTH_DEMO_NAME,
    };

    window.localStorage.setItem(MOCK_AUTH_STORAGE_KEY, JSON.stringify(mockUser));
    notifyMockAuthStateChanged();
  }

  return { ok: true as const };
}

export function signOutMockAuth() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(MOCK_AUTH_STORAGE_KEY);
  notifyMockAuthStateChanged();
}

const supabaseClient =
  (isSupabaseReady || isSupabaseDataSyncReady) && SUPABASE_URL && SUPABASE_ANON_KEY
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false,
        },
      })
    : null;

export function getSupabaseClient() {
  if (!supabaseClient) {
    throw new Error(getSupabaseUnavailableMessage());
  }

  return supabaseClient;
}

function fallbackNameFromUser(user: User) {
  const metadataName = user.user_metadata?.full_name ?? user.user_metadata?.name;
  return typeof metadataName === "string" && metadataName.trim() ? metadataName.trim() : undefined;
}

function normalizeAppRole(value: unknown): AppRole {
  return value === "admin" ? "admin" : "customer";
}

export async function getSupabaseUserProfile(user: User): Promise<SupabaseUserProfile> {
  const fallbackProfile: SupabaseUserProfile = {
    userId: user.id,
    email: user.email ?? "",
    fullName: fallbackNameFromUser(user),
    role: "customer",
  };

  if (!isSupabaseReady) return fallbackProfile;

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("user_profiles")
    .select("user_id,email,full_name,role")
    .eq("user_id", user.id)
    .maybeSingle<{
      user_id: string;
      email: string | null;
      full_name: string | null;
      role: AppRole | null;
    }>();

  if (error) {
    console.error("Failed to load Supabase user profile.", error);
    return fallbackProfile;
  }

  if (!data) return fallbackProfile;

  return {
    userId: data.user_id,
    email: data.email ?? fallbackProfile.email,
    fullName: data.full_name ?? fallbackProfile.fullName,
    role: normalizeAppRole(data.role),
  };
}

export function getAuthRedirectUrl(pathname: string) {
  const normalizedPath = pathname.startsWith("/") ? pathname : `/${pathname}`;

  if (APP_URL && APP_URL.trim()) {
    return new URL(normalizedPath, APP_URL).toString();
  }

  if (typeof window !== "undefined") {
    return new URL(normalizedPath, window.location.origin).toString();
  }

  return normalizedPath;
}

const supportedOtpTypes = new Set<EmailOtpType>([
  "signup",
  "magiclink",
  "invite",
  "recovery",
  "email",
  "email_change",
]);

function toOtpType(value: string | null): EmailOtpType | null {
  if (!value) return null;
  if (!supportedOtpTypes.has(value as EmailOtpType)) return null;
  return value as EmailOtpType;
}

function clearAuthUrlArtifacts(url: URL) {
  const hasAuthHashData =
    url.hash.includes("access_token=") ||
    url.hash.includes("refresh_token=") ||
    url.hash.includes("error_description=");

  url.searchParams.delete("code");
  url.searchParams.delete("token_hash");
  url.searchParams.delete("type");

  const nextSearch = url.searchParams.toString();
  const nextUrl = `${url.pathname}${nextSearch ? `?${nextSearch}` : ""}${hasAuthHashData ? "" : url.hash}`;

  window.history.replaceState({}, document.title, nextUrl);
}

export type AuthExchangeResult =
  | { status: "success"; flow: "code" | "otp" | "token"; otpType?: EmailOtpType }
  | { status: "none" }
  | { status: "error"; message: string };

export async function exchangeAuthSessionFromUrl(): Promise<AuthExchangeResult> {
  if (typeof window === "undefined") {
    return { status: "none" };
  }

  if (!isSupabaseAuthEnabled) {
    return { status: "none" };
  }

  if (!isSupabaseConfigured) {
    return {
      status: "error",
      message: SUPABASE_NOT_CONFIGURED_MESSAGE,
    };
  }

  const supabase = getSupabaseClient();
  const url = new URL(window.location.href);
  const hashParams = new URLSearchParams(url.hash.startsWith("#") ? url.hash.slice(1) : url.hash);

  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const otpType = toOtpType(url.searchParams.get("type"));
  const accessToken = hashParams.get("access_token");
  const refreshToken = hashParams.get("refresh_token");

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      return { status: "error", message: error.message };
    }

    clearAuthUrlArtifacts(url);
    return { status: "success", flow: "code" };
  }

  if (tokenHash && otpType) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: otpType });

    if (error) {
      return { status: "error", message: error.message };
    }

    clearAuthUrlArtifacts(url);
    return { status: "success", flow: "otp", otpType };
  }

  if (accessToken && refreshToken) {
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    if (error) {
      return { status: "error", message: error.message };
    }

    clearAuthUrlArtifacts(url);
    return { status: "success", flow: "token" };
  }

  return { status: "none" };
}
