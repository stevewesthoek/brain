# ProChat MicroSaaS Fast Boilerplate — Troubleshooting Guide

This guide is app-agnostic and applies to all microSaaS applications built using the ProChat MicroSaaS Fast Boilerplate. It provides universal debugging strategies, safe Codex behaviors, and guardrails to ensure that troubleshooting remains consistent, predictable, and non-destructive across future applications.

## When AI Can't Help: Self-Service Troubleshooting

This guide provides resources and strategies for solving problems independently when AI assistance reaches its limits or when you need to verify solutions.

## General Troubleshooting Strategy

### 1. Error Analysis Framework

When encountering an error, gather this information:

- **Error Message**: Copy the exact error text
- **Context**: What were you trying to do?
- **Environment**: Development/production, browser, OS
- **Recent Changes**: What did you modify recently?
- **Stack Trace**: Full error stack if available

### 2. Search Strategy

1. **Start Broad**: Search the error message directly
2. **Add Context**: Include technology name (Next.js, Clerk, Stripe, etc.)
3. **Check Documentation**: Official docs first, then community resources
4. **Look for Similar Issues**: GitHub issues, Stack Overflow, forums
5. **Verify Solutions**: Test solutions in a safe environment

## Technology-Specific Resources

### Next.js Issues

#### Common Problems

- **Build Errors**: `npm run build` failures
- **Runtime Errors**: Client/server hydration issues
- **Routing Problems**: App Router configuration
- **API Route Issues**: Server-side function errors

#### Search Terms

```
"Next.js 14 [error message]"
"Next.js App Router [specific issue]"
"Next.js build error [error code]"
"Next.js hydration error"
```

#### Documentation & Resources

- **Official Docs**: https://nextjs.org/docs
- **GitHub Issues**: https://github.com/vercel/next.js/issues
- **Stack Overflow**: https://stackoverflow.com/questions/tagged/next.js
- **Vercel Forums**: https://github.com/vercel/next.js/discussions

#### Quick Fixes to Try

```bash
# Clear Next.js cache
rm -rf .next
npm run dev

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# Check Node.js version compatibility
node --version
# Should be 18.17 or later for Next.js 14
```

### Clerk Authentication Issues

#### Common Problems

- **Sign-in Not Working**: Authentication flow failures
- **User Data Missing**: Profile information not loading
- **Middleware Errors**: Route protection issues
- **Webhook Problems**: User creation/update webhooks

#### Search Terms

```
"Clerk Next.js [error message]"
"Clerk authentication [specific issue]"
"Clerk middleware error"
"Clerk webhook [problem]"
```

#### Documentation & Resources

- **Official Docs**: https://clerk.com/docs
- **GitHub Issues**: https://github.com/clerkinc/clerk-nextjs/issues
- **Clerk Discord**: https://discord.gg/clerk
- **Stack Overflow**: https://stackoverflow.com/questions/tagged/clerk

#### Quick Fixes to Try

```bash
# Verify environment variables
echo $NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
echo $CLERK_SECRET_KEY

# Check Clerk dashboard configuration
# - Verify application settings
# - Check authentication methods
# - Review webhook configurations
```

### Stripe Payment Issues

#### Common Problems

- **Checkout Failures**: Payment processing errors
- **Webhook Errors**: Event processing failures
- **Subscription Issues**: Billing problems
- **API Errors**: Stripe API communication issues

#### Search Terms

```
"Stripe Next.js [error message]"
"Stripe webhook [specific issue]"
"Stripe checkout error"
"Stripe subscription [problem]"
```

#### Documentation & Resources

- **Official Docs**: https://stripe.com/docs
- **Stripe CLI**: https://stripe.com/docs/stripe-cli
- **GitHub Issues**: https://github.com/stripe/stripe-node/issues
- **Stripe Support**: https://support.stripe.com

#### Quick Fixes to Try

```bash
# Test webhook forwarding
stripe listen --forward-to localhost:3000/api/webhook/stripe

# Trigger test events
stripe trigger checkout.session.completed

# Check Stripe logs
stripe logs tail

# Verify API keys
stripe balance retrieve
```

### Database (Prisma/PostgreSQL) Issues

#### Common Problems

- **Connection Errors**: Database connectivity issues
- **Migration Failures**: Schema update problems
- **Query Errors**: Database operation failures
- **Performance Issues**: Slow queries or timeouts

#### Search Terms

```
"Prisma [error message]"
"PostgreSQL Next.js [issue]"
"Prisma migration [problem]"
"Database connection [error]"
```

#### Documentation & Resources

- **Prisma Docs**: https://www.prisma.io/docs
- **PostgreSQL Docs**: https://www.postgresql.org/docs
- **GitHub Issues**: https://github.com/prisma/prisma/issues
- **Stack Overflow**: https://stackoverflow.com/questions/tagged/prisma

#### Quick Fixes to Try

```bash
# Reset database
npx prisma migrate reset

# Regenerate Prisma client
npx prisma generate

# Check database connection
npx prisma db push --preview-feature

# View database in browser
npx prisma studio
```

### Email (Resend) Issues

#### Common Problems

- **Email Not Sending**: Delivery failures
- **Template Errors**: Email rendering issues
- **API Errors**: Resend API communication problems
- **Authentication Issues**: API key problems

#### Search Terms

```
"Resend [error message]"
"Resend email [specific issue]"
"Resend API error"
"Email delivery [problem]"
```

#### Documentation & Resources

- **Official Docs**: https://resend.com/docs
- **GitHub Issues**: https://github.com/resendlabs/resend-node/issues
- **Resend Support**: https://resend.com/support

#### Quick Fixes to Try

```bash
# Verify API key
curl -X POST https://api.resend.com/emails \
  -H "Authorization: Bearer re_..." \
  -H "Content-Type: application/json" \
  -d '{"from":"test@example.com","to":"test@example.com","subject":"Test","html":"<p>Test</p>"}'
```

## Environment-Specific Issues

### Development Environment

#### Common Problems

- **Port Conflicts**: Multiple services on same port
- **Environment Variables**: Missing or incorrect variables
- **Hot Reload Issues**: Changes not reflecting
- **Dependency Conflicts**: Package version mismatches

#### Search Terms

```
"Next.js development [error message]"
"npm start [specific issue]"
"environment variables [problem]"
"hot reload [issue]"
```

#### Quick Fixes to Try

```bash
# Kill processes on port 3000
lsof -ti:3000 | xargs kill -9

# Check environment variables
cat .env.local

# Clear all caches
rm -rf .next node_modules/.cache
npm run dev
```

### Production Environment

#### Common Problems

- **Build Failures**: Production build errors
- **Deployment Issues**: Platform-specific problems
- **Performance Problems**: Slow loading or crashes
- **Environment Mismatches**: Dev vs prod differences

#### Search Terms

```
"Next.js production [error message]"
"Vercel deployment [issue]"
"production build [problem]"
"deployment error [specific]"
```

#### Documentation & Resources

- **Vercel Docs**: https://vercel.com/docs
- **Netlify Docs**: https://docs.netlify.com
- **Platform-specific forums**

## Debugging Tools & Techniques

### 1. Browser Developer Tools

- **Console**: Check for JavaScript errors
- **Network**: Monitor API requests and responses
- **Application**: Inspect local storage, cookies, service workers
- **Performance**: Analyze loading times and bottlenecks

### 2. Server-Side Debugging

```bash
# Enable verbose logging
DEBUG=* npm run dev

# Check server logs
npm run dev 2>&1 | tee server.log

# Monitor file changes
npm run dev -- --turbo
```

### 3. Database Debugging

```bash
# Enable Prisma query logging
# Add to .env.local:
DATABASE_URL="postgresql://...?connection_limit=1&socket_timeout=3"

# Check database logs
docker logs postgres-container

# Monitor queries
npx prisma studio
```

### 4. API Testing

```bash
# Test API endpoints
curl -X GET http://localhost:3000/api/projects

# Test with authentication
curl -X GET http://localhost:3000/api/projects \
  -H "Authorization: Bearer [token]"
```

## Community Resources

### 1. Stack Overflow

- **Search Strategy**: Use specific error messages and technology tags
- **Ask Questions**: Provide minimal reproducible examples
- **Answer Quality**: Look for accepted answers with high votes

### 2. GitHub Issues

- **Search Existing Issues**: Check if problem is already reported
- **Create New Issues**: Follow project's issue template
- **Check Discussions**: Look for community solutions

### 3. Discord/Slack Communities

- **Next.js Discord**: https://discord.gg/nextjs
- **Clerk Discord**: https://discord.gg/clerk
- **Stripe Discord**: https://discord.gg/stripe
- **Prisma Discord**: https://discord.gg/prisma

### 4. Reddit Communities

- **r/nextjs**: https://reddit.com/r/nextjs
- **r/reactjs**: https://reddit.com/r/reactjs
- **r/webdev**: https://reddit.com/r/webdev

## When to Seek Professional Help

### 1. Signs You Need Expert Assistance

- **Complex Architecture Issues**: Multi-service integration problems
- **Security Vulnerabilities**: Authentication or data protection issues
- **Performance Critical**: Production performance problems
- **Business Critical**: Revenue-impacting payment issues

### 2. Professional Resources

- **Freelance Platforms**: Upwork, Fiverr, Toptal
- **Consulting Services**: Technology-specific consultants
- **Platform Support**: Vercel, Stripe, Clerk premium support
- **Community Experts**: Reputable developers in community forums

## Prevention Strategies

### 1. Development Best Practices

- **Version Control**: Use Git for all changes
- **Environment Management**: Separate dev/staging/prod environments
- **Testing**: Implement unit and integration tests
- **Documentation**: Keep code and setup documentation updated

### 2. Monitoring & Logging

- **Error Tracking**: Implement error monitoring (Sentry, LogRocket)
- **Performance Monitoring**: Track application performance
- **User Analytics**: Monitor user behavior and errors
- **Health Checks**: Implement system health monitoring

### 3. Backup & Recovery

- **Database Backups**: Regular database backups
- **Code Backups**: Version control and deployment backups
- **Configuration Backups**: Environment and configuration backups
- **Disaster Recovery**: Plan for system failures

## Quick Reference Commands

### Development

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Run production server
npm start

# Run linting
npm run lint

# Run database migrations
npm run migrate-db
```

### Debugging

```bash
# Check Node.js version
node --version

# Check npm version
npm --version

# List installed packages
npm list

# Check for outdated packages
npm outdated

# Clear npm cache
npm cache clean --force
```

### Database

```bash
# Reset database
npx prisma migrate reset

# Generate Prisma client
npx prisma generate

# Open database browser
npx prisma studio

# Push schema changes
npx prisma db push
```

### Stripe

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Login to Stripe
stripe login

# Listen to webhooks
stripe listen --forward-to localhost:3000/api/webhook/stripe

# Trigger test events
stripe trigger checkout.session.completed
```

Remember: Most problems have been solved before. Take time to search thoroughly and understand the root cause before implementing solutions.

---

## Codex 5.1 Troubleshooting Rules (App-Agnostic)

These rules define how Codex 5.1 must behave when investigating, troubleshooting, or modifying code in response to errors.

### 1. Minimal-Diff Debugging
Codex must:
- propose the smallest possible change required to fix the issue
- avoid rewriting entire files
- avoid making structural or architectural changes during debugging
- avoid moving or renaming files

### 2. No Assumptions — Verify All Context
Codex must:
- refer to the Appendix folder tree when locating files
- examine only the files the user provides
- avoid creating new libraries or utilities unless requested
- ask for missing context instead of guessing

### 3. Protected Systems — Do Not Modify
Codex must NOT modify unless explicitly instructed:
- Clerk authentication components
- Stripe billing logic
- n8n or Make automations
- Prisma core logic or schema
- SEO or Blog engine components
- Global layout, theme, and UI providers

### 4. Token-Efficient Troubleshooting
Codex must:
- avoid restating large sections of unchanged code
- avoid regenerating schemas or config files
- avoid unnecessary explanations beyond what is required to resolve the issue

### 5. Error-First Reasoning
Codex must:
- always request the exact error message if not provided
- request the relevant file(s) before proposing a fix
- propose a hypothesis based on the error
- confirm with the user before applying significant changes

### 6. Preserve Boilerplate Integrity
Codex must:
- respect the architecture of the ProChat MicroSaaS Fast Boilerplate
- avoid introducing breaking changes to routing, auth, billing, or middleware
- avoid upgrading dependencies during debugging

### 7. Ask Before Acting
If a debugging step requires:
- schema changes
- refactoring
- dependency updates
- modifications to protected files

Codex must ask the user for confirmation before proceeding.

### 8. Avoid Quick-Fix Anti-patterns
Codex must NOT:
- suppress errors by removing code
- wrap unclear functions in try/catch blocks without explanation
- use `any` as a type workaround without justification
- comment out large blocks unless explicitly instructed

### 9. Align With Boilerplate Philosophy
Codex must:
- maintain simplicity
- preserve speed of shipping
- avoid unnecessary abstraction
- follow existing patterns rather than invent new ones

### 10. When in Doubt — Request Clarification
Codex must always pause and ask the user before making changes that could:
- cause regressions
- touch multiple subsystems
- impact multi-tenant behavior
- impact billing or auth
