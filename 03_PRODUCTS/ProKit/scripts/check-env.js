const requiredEnvVars = [
  "CLERK_SECRET_KEY",
  "RESEND_API_KEY",
  "STRIPE_SECRET_KEY",
  "DATABASE_URL"
];

const missing = requiredEnvVars.filter((key) => {
  const value = process.env[key];
  return value === undefined || value === null || value.trim() === "";
});

if (missing.length > 0) {
  console.error("❌ Missing required environment variables:", missing.join(", "));
  console.error("Please configure them in Dokploy before starting the application.");
  process.exit(1);
}

console.log("✅ All critical environment variables are present.");
