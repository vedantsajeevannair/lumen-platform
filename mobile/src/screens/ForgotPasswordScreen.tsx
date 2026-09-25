import { useState } from "react";
import {
  KeyboardAvoidingView, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from "react-native";
import { forgotPassword, resetPassword } from "../api";
import { C, S, R, F, E } from "../theme";
import { Button } from "../ui";

/**
 * Password reset, in the two steps the user actually experiences: ask for a
 * code, then use it.
 *
 * The server answers a request the same way whether or not the address has an
 * account, so this screen does too — it moves to the code step either way. A
 * screen that said "no account with that address" would turn the reset form
 * into a way of finding out who is registered.
 */
export default function ForgotPasswordScreen({ onBack, onDone }: {
  onBack: () => void;
  onDone: (email: string) => void;
}) {
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [focus, setFocus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  async function sendCode() {
    setError(null);
    if (!email.trim()) return setError("Enter the email address on your account.");
    setBusy(true);
    try {
      const res = await forgotPassword(email.trim());
      setStep("code");
      // Present only while no mail provider is configured on the deployment.
      // Shown rather than hidden: a code the user cannot receive and cannot
      // see is a dead end, and pretending the mail was sent would be worse.
      setNote(res.devCode ? `Mail is not configured yet — your code is ${res.devCode}` : null);
    } catch (e: any) {
      setError(e?.message ?? "Could not request a code.");
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    setError(null);
    if (!code.trim()) return setError("Enter the six-digit code.");
    if (password.length < 8) return setError("Choose a password of at least 8 characters.");
    setBusy(true);
    try {
      await resetPassword(email.trim(), code.trim(), password);
      onDone(email.trim());
    } catch (e: any) {
      setError(e?.message ?? "Could not reset the password.");
    } finally {
      setBusy(false);
    }
  }

  const field = (key: string) => [s.input, focus === key && s.inputFocus];

  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <View style={s.card}>
          <Text style={s.h1}>Reset your password</Text>
          <Text style={s.h2}>
            {step === "email"
              ? "We will send a six-digit code to your email address."
              : "Enter the code we sent, then choose a new password."}
          </Text>

          <Text style={s.label}>Email</Text>
          <TextInput
            style={field("email")} value={email} onChangeText={setEmail}
            onFocus={() => setFocus("email")} onBlur={() => setFocus(null)}
            placeholder="you@example.com" autoCapitalize="none" keyboardType="email-address"
            autoCorrect={false} editable={step === "email"} placeholderTextColor={C.muted}
          />

          {step === "code" && (
            <>
              <Text style={s.label}>Six-digit code</Text>
              <TextInput
                style={[...field("code"), s.code]} value={code} onChangeText={setCode}
                onFocus={() => setFocus("code")} onBlur={() => setFocus(null)}
                placeholder="000000" keyboardType="number-pad" maxLength={6}
                placeholderTextColor={C.muted}
              />
              <Text style={s.label}>New password</Text>
              <TextInput
                style={field("password")} value={password} onChangeText={setPassword}
                onFocus={() => setFocus("password")} onBlur={() => setFocus(null)}
                placeholder="At least 8 characters" secureTextEntry
                placeholderTextColor={C.muted}
              />
            </>
          )}

          {note && (
            <View style={s.noteBox}>
              <Text style={s.noteText}>{note}</Text>
            </View>
          )}
          {error && (
            <View style={s.errorBox}>
              <Text style={s.errorText}>{error}</Text>
            </View>
          )}

          <Button
            label={step === "email" ? "Send code" : "Set new password"}
            onPress={step === "email" ? sendCode : submit}
            busy={busy}
            style={{ marginTop: S.xl }}
          />

          {step === "code" && (
            <Pressable onPress={sendCode} hitSlop={8} disabled={busy}>
              <Text style={s.link}>Send another code</Text>
            </Pressable>
          )}

          <Pressable onPress={onBack} hitSlop={8}>
            <Text style={s.link}>Back to sign in</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  scroll: { flexGrow: 1, padding: S.xl, justifyContent: "center" },
  card: {
    backgroundColor: C.surface, borderRadius: R.xl, padding: S.xl,
    borderWidth: 1, borderColor: C.line, ...E.raised,
  },
  h1: { ...F.title },
  h2: { ...F.caption, marginTop: S.xs, marginBottom: S.lg },
  label: { ...F.caption, color: C.body, fontWeight: "700", marginTop: S.lg, marginBottom: 6 },
  input: {
    borderWidth: 1.5, borderColor: C.line, borderRadius: R.md, backgroundColor: C.bg,
    paddingHorizontal: S.md, paddingVertical: 13, fontSize: 16, color: C.ink,
  },
  inputFocus: { borderColor: C.ink, backgroundColor: C.surface },
  code: { letterSpacing: 8, fontSize: 20, fontWeight: "700", textAlign: "center" },
  noteBox: {
    backgroundColor: C.warnSoft, borderRadius: R.md, padding: S.md, marginTop: S.lg,
    borderWidth: 1, borderColor: C.warn,
  },
  noteText: { color: C.warn, fontSize: 13, lineHeight: 19 },
  errorBox: {
    backgroundColor: C.badSoft, borderRadius: R.md, padding: S.md, marginTop: S.lg,
    borderWidth: 1, borderColor: C.bad,
  },
  errorText: { color: C.bad, fontSize: 13, lineHeight: 19 },
  link: { ...F.caption, color: C.brand, fontWeight: "700", textAlign: "center", marginTop: S.lg },
});
