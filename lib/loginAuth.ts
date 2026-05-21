export function loginToEmail(login: string) {
  const normalizedLogin = login.trim().toLowerCase();
  const encodedLogin = Array.from(normalizedLogin)
    .map((char) => char.charCodeAt(0).toString(16).padStart(4, "0"))
    .join("");

  return `couplespace.user.${encodedLogin}@gmail.com`;
}

export function validateLoginCredentials(login: string, password: string) {
  const trimmedLogin = login.trim();

  if (trimmedLogin.length < 3) {
    return "Логин должен быть минимум 3 символа";
  }

  if (password.length < 6) {
    return "Пароль должен быть минимум 6 символов";
  }

  return null;
}
