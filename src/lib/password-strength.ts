export type PasswordStrengthLevel = "none" | "weak" | "medium" | "strong";

export type PasswordRule = {
  id: string;
  label: string;
  test: (value: string) => boolean;
};

export const PASSWORD_RULES: PasswordRule[] = [
  {
    id: "length",
    label: "Tối thiểu 10 ký tự",
    test: (value) => value.length >= 10,
  },
  {
    id: "uppercase",
    label: "Có ít nhất 1 chữ hoa (A-Z)",
    test: (value) => /[A-Z]/.test(value),
  },
  {
    id: "lowercase",
    label: "Có ít nhất 1 chữ thường (a-z)",
    test: (value) => /[a-z]/.test(value),
  },
  {
    id: "number",
    label: "Có ít nhất 1 chữ số (0-9)",
    test: (value) => /\d/.test(value),
  },
  {
    id: "special",
    label: "Có ít nhất 1 ký tự đặc biệt (!@#$...)",
    test: (value) => /[^A-Za-z0-9]/.test(value),
  },
];

export function evaluatePasswordStrength(value: string) {
  const checks = PASSWORD_RULES.map((rule) => ({
    ...rule,
    met: rule.test(value),
  }));

  const score = checks.filter((rule) => rule.met).length;
  const percent = Math.round((score / PASSWORD_RULES.length) * 100);

  let level: PasswordStrengthLevel = "none";
  let label = "Chưa nhập mật khẩu";

  if (value.length > 0 && score <= 2) {
    level = "weak";
    label = "Yếu";
  } else if (score >= 3 && score <= 4) {
    level = "medium";
    label = "Trung bình";
  } else if (score === PASSWORD_RULES.length) {
    level = "strong";
    label = "Mạnh";
  }

  return {
    checks,
    score,
    percent,
    level,
    label,
    isStrong: score === PASSWORD_RULES.length,
  };
}