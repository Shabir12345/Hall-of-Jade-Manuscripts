# Bundle Size Analysis & Optimization Strategy

## Overview

This document outlines the bundle size analysis approach and optimization strategy for the Hall of Jade Manuscripts application.

## Bundle Analysis Tools

### 1. Rollup Plugin Visualizer

We use `rollup-plugin-visualizer` to analyze bundle size and identify optimization opportunities.

**Installation:**
```bash
npm install --save-dev rollup-plugin-visualizer
```

**Usage:**
```bash
npm run build:analyze
```

This generates an interactive HTML report showing:
- Bundle sizes and composition
- Code splitting effectiveness
- Largest dependencies
- Duplicate code detection
- Tree-shaking effectiveness

## Current Bundle Strategy

### Code Splitting

The application uses manual chunk splitting in `vite.config.ts`:

1. **vendor-react**: React and React DOM (~130KB gzipped)
2. **vendor-supabase**: Supabase client library (~80KB gzipped)
3. **vendor-zod**: Zod validation library (~15KB gzipped)
4. **vendor**: Other node_modules dependencies
5. **main**: Application code

### Lazy Loading

- Components are lazy-loaded using `React.lazy()` where appropriate
- Route-based code splitting is implemented for major views

### Tree Shaking

- Use ES modules for all dependencies
- Import only needed functions from libraries
- Avoid default imports from large libraries

## Bundle Size Targets

| Bundle | Target Size | Current | Status |
|--------|-------------|---------|--------|
| Main Bundle | < 200KB (gzipped) | TBD | 🔄 |
| vendor-react | < 150KB (gzipped) | TBD | 🔄 |
| vendor-supabase | < 100KB (gzipped) | TBD | 🔄 |
| Total Initial Load | < 500KB (gzipped) | TBD | 🔄 |

## Optimization Strategies

### 1. Dependency Management

**Review Dependencies:**
- Regularly audit dependencies for unused packages
- Replace large dependencies with lighter alternatives where possible
- Use peer dependencies to avoid duplication

**Examples:**
- ✅ Use `@supabase/supabase-js` (tree-shakeable)
- ✅ Use `zod` only where validation is needed
- ✅ Consider alternatives for large UI libraries

### 2. Code Splitting

**Route-Based Splitting:**
```typescript
const DashboardView = lazy(() => import('./components/views/DashboardView'));
const CharactersView = lazy(() => import('./components/views/CharactersView'));
```

**Component-Based Splitting:**
- Split large components into separate chunks
- Lazy load heavy components (editors, visualizations)
- Split vendor code by feature domain

### 3. Dynamic Imports

**Service Imports:**
```typescript
// Instead of: import { heavyService } from './services';
const heavyService = await import('./services/heavyService');
```

**Third-Party Libraries:**
```typescript
// Instead of: import Chart from 'chart.js';
const Chart = (await import('chart.js')).default;
```

### 4. Tree Shaking

**Best Practices:**
- Use named exports instead of default exports
- Import only what you need: `import { debounce } from 'lodash-es'`
- Avoid barrel exports that re-export everything
- Use side-effect-free modules

### 5. Asset Optimization

**Images:**
- Use modern formats (WebP, AVIF)
- Lazy load images below the fold
- Use responsive images with `srcset`
- Consider using image CDNs

**Fonts:**
- Subset fonts to only needed characters
- Use `font-display: swap` for better performance
- Preload critical fonts

### 6. Compression

**Build Configuration:**
- Enable gzip compression on server
- Use Brotli compression when available
- Minify JavaScript and CSS
- Remove source maps from production builds

## Analysis Commands

### Basic Analysis
```bash
npm run build:analyze
```

### Detailed Analysis
```bash
npm run build:analyze -- --open
```

### Compare Builds
```bash
npm run build:analyze:compare
```

## Monitoring

### Build-Time Monitoring

Add bundle size checks to CI/CD:
- Fail builds if bundle size exceeds thresholds
- Track bundle size over time
- Alert on significant size increases

### Runtime Monitoring

Monitor actual bundle sizes in production:
- Track initial load size
- Monitor chunk loading times
- Track cache hit rates

## Optimization Checklist

- [ ] Run bundle analysis tool
- [ ] Identify largest dependencies
- [ ] Review and remove unused dependencies
- [ ] Implement code splitting for routes
- [ ] Lazy load heavy components
- [ ] Optimize images and assets
- [ ] Enable compression
- [ ] Set up bundle size monitoring
- [ ] Document optimization decisions
- [ ] Review and update regularly

## Future Optimizations

### Short Term
- [ ] Implement route-based code splitting
- [ ] Lazy load editor components
- [ ] Optimize chart/visualization libraries
- [ ] Review and optimize Supabase client usage

### Medium Term
- [ ] Implement service worker for caching
- [ ] Add resource hints (preload, prefetch)
- [ ] Optimize font loading
- [ ] Implement progressive loading

### Long Term
- [ ] Consider micro-frontend architecture
- [ ] Evaluate WebAssembly for heavy computations
- [ ] Implement edge computing for static assets
- [ ] Review overall architecture for optimization opportunities

## References

- [Vite Bundle Analysis](https://vitejs.dev/guide/build.html#bundle-analyzer)
- [Webpack Bundle Analyzer](https://github.com/webpack-contrib/webpack-bundle-analyzer)
- [Bundle Size Best Practices](https://web.dev/reduce-javascript-payloads-with-code-splitting/)
