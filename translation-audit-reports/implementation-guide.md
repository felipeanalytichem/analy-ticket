# Hardcoded Strings Implementation Guide

This guide provides practical steps for implementing the translation of hardcoded strings identified in the audit.

## Quick Start: Top 20 Priority Strings

Based on the audit results, here are the top 20 strings to implement first:

### 1. "Cancel" Button (15 occurrences)
**Files:** TicketDialog.tsx, TaskManagement.tsx, LoadingFallback.tsx
```tsx
// Before
<Button onClick={onCancel}>Cancel</Button>

// After
<Button onClick={onCancel}>
  <SafeTranslation i18nKey="common.cancel" fallback="Cancel" />
</Button>
```

**Translation Keys to Add:**
```json
{
  "common": {
    "cancel": "Cancel"
  }
}
```

### 2. Interactive Buttons (159 total)
**High Priority Examples:**
- "Save" → `common.save`
- "Delete" → `common.delete`
- "Edit" → `common.edit`
- "Add" → `common.add`
- "Submit" → `common.submit`

### 3. Form Labels and Placeholders
**Examples from CategoryManagement.tsx:**
```tsx
// Before
<Input placeholder="Enter category name" />

// After
<Input placeholder={t("forms.category.name_placeholder", "Enter category name")} />
```

### 4. Accessibility Attributes
**Examples:**
```tsx
// Before
<button aria-label="Close dialog">×</button>

// After
<button aria-label={t("accessibility.close_dialog", "Close dialog")}>×</button>
```

## Implementation Steps

### Step 1: Set Up Translation Keys Structure

Create a hierarchical structure in your translation files:

```json
{
  "common": {
    "actions": {
      "save": "Save",
      "cancel": "Cancel",
      "delete": "Delete",
      "edit": "Edit",
      "add": "Add",
      "submit": "Submit",
      "close": "Close"
    },
    "status": {
      "loading": "Loading...",
      "error": "Error",
      "success": "Success",
      "pending": "Pending"
    }
  },
  "forms": {
    "validation": {
      "required": "This field is required",
      "invalid_email": "Please enter a valid email address",
      "min_length": "Must be at least {{min}} characters"
    },
    "labels": {
      "name": "Name",
      "email": "Email",
      "password": "Password",
      "description": "Description"
    }
  },
  "dialogs": {
    "confirmation": {
      "title": "Confirm Action",
      "message": "Are you sure you want to proceed?",
      "confirm": "Confirm",
      "cancel": "Cancel"
    }
  }
}
```

### Step 2: Replace High-Priority Strings

Start with the strings that have the highest visibility scores:

#### Interactive Elements (Score: 23.7)
```tsx
// components/admin/CategoryManagement.tsx
// Before
<Button variant="destructive" onClick={handleDelete}>
  Delete Category
</Button>

// After
<Button variant="destructive" onClick={handleDelete}>
  <SafeTranslation 
    i18nKey="admin.categories.delete_category" 
    fallback="Delete Category" 
  />
</Button>
```

#### UI Text Content (Score: 21.1)
```tsx
// Before
<h2>Assignment Rules Manager</h2>

// After
<h2>
  <SafeTranslation 
    i18nKey="admin.assignment.title" 
    fallback="Assignment Rules Manager" 
  />
</h2>
```

### Step 3: Handle Form Elements

Forms require special attention for labels, placeholders, and validation:

```tsx
// Before
<div>
  <label>Category Name</label>
  <Input 
    placeholder="Enter category name"
    required
  />
  {error && <span>Category name is required</span>}
</div>

// After
<div>
  <label>
    <SafeTranslation 
      i18nKey="forms.category.name_label" 
      fallback="Category Name" 
    />
  </label>
  <Input 
    placeholder={useSafeTranslation(
      "forms.category.name_placeholder", 
      "Enter category name"
    )}
    required
  />
  {error && (
    <span>
      <SafeTranslation 
        i18nKey="forms.category.name_required" 
        fallback="Category name is required" 
      />
    </span>
  )}
</div>
```

### Step 4: Accessibility Attributes

Ensure all accessibility attributes are translatable:

```tsx
// Before
<button 
  aria-label="Close modal"
  title="Close this dialog"
>
  ×
</button>

// After
<button 
  aria-label={useSafeTranslation("accessibility.close_modal", "Close modal")}
  title={useSafeTranslation("accessibility.close_dialog", "Close this dialog")}
>
  ×
</button>
```

## File-by-File Implementation Priority

### Phase 1 Files (Week 1)
1. **components/tickets/dialogs/TicketDialog.tsx** - 15 high-priority strings
2. **components/ui/LoadingFallback.tsx** - Common UI elements
3. **components/admin/CategoryManagement.tsx** - Admin interface buttons

### Phase 2 Files (Week 2-3)
1. **components/admin/AssignmentRulesManager.tsx** - 89 strings total
2. **components/tickets/TicketDetail.tsx** - 54 strings
3. **components/admin/UserManagement.tsx** - 48 strings

## Testing Strategy

### 1. Development Testing
```tsx
// Add to your component tests
describe('Internationalization', () => {
  it('should display translated text', () => {
    render(<YourComponent />, { 
      wrapper: ({ children }) => (
        <I18nextProvider i18n={testI18n}>
          {children}
        </I18nextProvider>
      )
    });
    
    expect(screen.getByText('Translated Text')).toBeInTheDocument();
  });
  
  it('should fallback to default text when translation missing', () => {
    // Test fallback behavior
  });
});
```

### 2. Visual Testing
- Test each language switch
- Verify text doesn't overflow containers
- Check RTL languages if supported
- Validate accessibility attributes

### 3. Automated Detection
Use the enhanced audit script regularly:
```bash
# Run weekly to catch new hardcoded strings
npm run audit:translations

# Check specific files after changes
node scripts/enhanced-translation-audit.cjs --files "src/components/new-feature"
```

## Common Patterns and Solutions

### Pattern 1: Conditional Text
```tsx
// Before
<span>{isActive ? 'Active' : 'Inactive'}</span>

// After
<span>
  <SafeTranslation 
    i18nKey={isActive ? "status.active" : "status.inactive"}
    fallback={isActive ? "Active" : "Inactive"}
  />
</span>
```

### Pattern 2: Dynamic Content
```tsx
// Before
<p>Welcome back, {userName}!</p>

// After
<p>
  <SafeTranslation 
    i18nKey="welcome.message"
    fallback="Welcome back, {{name}}!"
    values={{ name: userName }}
  />
</p>
```

### Pattern 3: Pluralization
```tsx
// Before
<span>{count} item{count !== 1 ? 's' : ''}</span>

// After
<span>
  <SafeTranslation 
    i18nKey="items.count"
    fallback="{{count}} item"
    values={{ count }}
  />
</span>
```

## Maintenance and Monitoring

### 1. Pre-commit Hooks
Add a git hook to check for new hardcoded strings:
```bash
#!/bin/sh
# .git/hooks/pre-commit
node scripts/enhanced-translation-audit.cjs --check-new
```

### 2. CI/CD Integration
```yaml
# .github/workflows/translation-check.yml
name: Translation Check
on: [pull_request]
jobs:
  check-translations:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Check for hardcoded strings
        run: |
          node scripts/enhanced-translation-audit.cjs --ci
          if [ $? -ne 0 ]; then
            echo "New hardcoded strings detected. Please add translations."
            exit 1
          fi
```

### 3. Regular Audits
- Run full audit monthly
- Review translation completeness quarterly
- Update translations based on user feedback
- Monitor performance impact of translation loading

## Troubleshooting

### Common Issues

1. **Translation Key Not Found**
   - Check key spelling and hierarchy
   - Verify translation file is loaded
   - Use fallback text for graceful degradation

2. **Text Overflow**
   - Test with longer translations (German, Finnish)
   - Use CSS text-overflow or flexible layouts
   - Consider abbreviations for space-constrained areas

3. **Context Loss**
   - Use descriptive translation keys
   - Add context comments in translation files
   - Group related translations logically

4. **Performance Issues**
   - Lazy load translation files
   - Use translation caching
   - Minimize translation bundle size

This implementation guide provides a structured approach to replacing the 2,793 identified hardcoded strings with proper internationalization support.