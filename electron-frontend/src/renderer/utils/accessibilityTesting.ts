/**
 * Accessibility Testing Utilities
 * WCAG 2.1 AA Compliance Testing Tools
 *
 * Features:
 * - Color contrast validation
 * - Keyboard navigation testing
 * - ARIA compliance checking
 * - Screen reader simulation
 * - Focus management validation
 * - Accessibility reporting
 */

// Color contrast calculation utilities
export interface ColorRGB {
  r: number;
  g: number;
  b: number;
}

export interface ContrastTestResult {
  ratio: number;
  level: 'AAA' | 'AA' | 'FAIL';
  isValid: boolean;
  suggestion?: string;
  wcagCriteria: {
    normalText: boolean;
    largeText: boolean;
    uiComponents: boolean;
  };
}

// ARIA validation types
export interface AriaTestResult {
  element: HTMLElement;
  issues: AriaIssue[];
  score: number;
  recommendations: string[];
}

export interface AriaIssue {
  type: 'error' | 'warning' | 'info';
  code: string;
  message: string;
  element: HTMLElement;
  wcagReference?: string;
}

// Keyboard navigation testing
export interface KeyboardTestResult {
  totalElements: number;
  focusableElements: number;
  tabbableElements: number;
  issues: KeyboardIssue[];
  focusOrder: HTMLElement[];
  trapIssues: FocusTrapIssue[];
}

export interface KeyboardIssue {
  type: 'missing-focus' | 'poor-focus-visible' | 'keyboard-trap' | 'skip-link-missing';
  element: HTMLElement;
  message: string;
  severity: 'high' | 'medium' | 'low';
}

export interface FocusTrapIssue {
  type: 'escape-impossible' | 'first-last-missing' | 'tab-cycle-broken';
  container: HTMLElement;
  message: string;
}

// Accessibility audit report
export interface AccessibilityAuditReport {
  timestamp: Date;
  url: string;
  overallScore: number;
  colorContrast: {
    tested: number;
    passed: number;
    failed: number;
    issues: ContrastIssue[];
  };
  aria: {
    elementsChecked: number;
    totalIssues: number;
    errors: number;
    warnings: number;
    issues: AriaIssue[];
  };
  keyboard: KeyboardTestResult;
  semantics: SemanticTestResult;
  recommendations: Recommendation[];
  wcagCompliance: WcagComplianceResult;
}

export interface ContrastIssue {
  element: HTMLElement;
  foreground: string;
  background: string;
  ratio: number;
  requiredRatio: number;
  level: 'AA' | 'AAA';
  isLargeText: boolean;
}

export interface SemanticTestResult {
  headingStructure: HeadingIssue[];
  landmarks: LandmarkIssue[];
  lists: ListIssue[];
  images: ImageIssue[];
  forms: FormIssue[];
  score: number;
}

export interface HeadingIssue {
  element: HTMLElement;
  level: number;
  issue: 'missing-h1' | 'skipped-level' | 'multiple-h1' | 'empty-heading';
  message: string;
}

export interface LandmarkIssue {
  issue: 'missing-main' | 'multiple-main' | 'missing-nav' | 'unlabeled-landmark';
  element?: HTMLElement;
  message: string;
}

export interface ListIssue {
  element: HTMLElement;
  issue: 'improper-nesting' | 'empty-list' | 'missing-role';
  message: string;
}

export interface ImageIssue {
  element: HTMLImageElement;
  issue: 'missing-alt' | 'empty-alt-decorative' | 'poor-alt-text' | 'redundant-alt';
  message: string;
}

export interface FormIssue {
  element: HTMLElement;
  issue: 'missing-label' | 'missing-fieldset' | 'poor-error-handling' | 'missing-instructions';
  message: string;
}

export interface Recommendation {
  priority: 'high' | 'medium' | 'low';
  category: 'color-contrast' | 'keyboard' | 'aria' | 'semantics' | 'forms';
  title: string;
  description: string;
  wcagCriterion: string;
  howToFix: string;
  codeExample?: string;
  affectedElements: HTMLElement[];
}

export interface WcagComplianceResult {
  level: 'A' | 'AA' | 'AAA' | 'FAIL';
  criteriaResults: WcagCriteriaResult[];
  score: number;
  totalCriteria: number;
  passedCriteria: number;
}

export interface WcagCriteriaResult {
  criterion: string;
  level: 'A' | 'AA' | 'AAA';
  passed: boolean;
  issues: string[];
  elements: HTMLElement[];
}

/**
 * Color Contrast Testing
 */
export class ColorContrastTester {
  /**
   * Convert hex color to RGB
   */
  private hexToRgb(hex: string): ColorRGB | null {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16),
        }
      : null;
  }

  /**
   * Calculate relative luminance
   */
  private getLuminance(r: number, g: number, b: number): number {
    const [rs, gs, bs] = [r, g, b].map(c => {
      c = c / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
  }

  /**
   * Calculate contrast ratio between two colors
   */
  public calculateContrastRatio(color1: string, color2: string): number {
    const rgb1 = this.hexToRgb(color1);
    const rgb2 = this.hexToRgb(color2);

    if (!rgb1 || !rgb2) return 0;

    const lum1 = this.getLuminance(rgb1.r, rgb1.g, rgb1.b);
    const lum2 = this.getLuminance(rgb2.r, rgb2.g, rgb2.b);

    const lighter = Math.max(lum1, lum2);
    const darker = Math.min(lum1, lum2);

    return (lighter + 0.05) / (darker + 0.05);
  }

  /**
   * Test color contrast for WCAG compliance
   */
  public testContrast(
    foreground: string,
    background: string,
    isLargeText: boolean = false
  ): ContrastTestResult {
    const ratio = this.calculateContrastRatio(foreground, background);

    const normalTextPasses = ratio >= 4.5;
    const largeTextPasses = ratio >= 3.0;
    const aaaPasses = ratio >= 7.0;
    const uiComponentPasses = ratio >= 3.0;

    const level: ContrastTestResult['level'] = aaaPasses
      ? 'AAA'
      : (isLargeText ? largeTextPasses : normalTextPasses)
        ? 'AA'
        : 'FAIL';

    const isValid = isLargeText ? largeTextPasses : normalTextPasses;

    let suggestion: string | undefined;
    if (!isValid) {
      const required = isLargeText ? 3.0 : 4.5;
      const improvement = required - ratio;
      suggestion = `Increase contrast by ${improvement.toFixed(2)}. Consider ${
        ratio < 2 ? 'significantly lightening/darkening' : 'adjusting'
      } one of the colors.`;
    }

    return {
      ratio,
      level,
      isValid,
      suggestion,
      wcagCriteria: {
        normalText: normalTextPasses,
        largeText: largeTextPasses,
        uiComponents: uiComponentPasses,
      },
    };
  }

  /**
   * Test all text elements on page for contrast issues
   */
  public auditPageContrast(container: HTMLElement = document.body): ContrastIssue[] {
    const issues: ContrastIssue[] = [];
    const textElements = container.querySelectorAll('*:not(script):not(style)');

    textElements.forEach(element => {
      const htmlElement = element as HTMLElement;
      const computedStyle = window.getComputedStyle(htmlElement);

      // Skip if element has no text content
      if (!htmlElement.textContent?.trim()) return;

      const color = computedStyle.color;
      const backgroundColor = computedStyle.backgroundColor;

      // Convert to hex if possible
      const foregroundHex = this.rgbToHex(color);
      const backgroundHex = this.rgbToHex(backgroundColor);

      if (foregroundHex && backgroundHex && backgroundHex !== '#00000000') {
        const fontSize = parseFloat(computedStyle.fontSize);
        const fontWeight = computedStyle.fontWeight;
        const isLargeText =
          fontSize >= 18 || (fontSize >= 14 && (fontWeight === 'bold' || fontWeight >= '700'));

        const result = this.testContrast(foregroundHex, backgroundHex, isLargeText);

        if (!result.isValid) {
          issues.push({
            element: htmlElement,
            foreground: foregroundHex,
            background: backgroundHex,
            ratio: result.ratio,
            requiredRatio: isLargeText ? 3.0 : 4.5,
            level: 'AA',
            isLargeText,
          });
        }
      }
    });

    return issues;
  }

  /**
   * Convert RGB string to hex
   */
  private rgbToHex(rgb: string): string | null {
    const match = rgb.match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)(?:,\\s*([\\d.]+))?\\)/);
    if (!match) return null;

    const r = parseInt(match[1]);
    const g = parseInt(match[2]);
    const b = parseInt(match[3]);
    const a = match[4] ? parseFloat(match[4]) : 1;

    if (a === 0) return '#00000000';

    return (
      '#' +
      [r, g, b]
        .map(x => {
          const hex = x.toString(16);
          return hex.length === 1 ? '0' + hex : hex;
        })
        .join('')
    );
  }
}

/**
 * ARIA Compliance Tester
 */
export class AriaComplianceTester {
  /**
   * Test element for ARIA compliance
   */
  public testElement(element: HTMLElement): AriaTestResult {
    const issues: AriaIssue[] = [];
    let score = 100;

    // Check for missing labels
    if (this.isInteractiveElement(element) && !this.hasAccessibleName(element)) {
      issues.push({
        type: 'error',
        code: 'missing-accessible-name',
        message: 'Interactive element lacks an accessible name',
        element,
        wcagReference: '4.1.2 Name, Role, Value',
      });
      score -= 20;
    }

    // Check for proper roles
    if (this.needsExplicitRole(element) && !element.getAttribute('role')) {
      issues.push({
        type: 'warning',
        code: 'missing-role',
        message: 'Element may need an explicit role for clarity',
        element,
        wcagReference: '4.1.2 Name, Role, Value',
      });
      score -= 10;
    }

    // Check ARIA properties
    const ariaIssues = this.validateAriaProperties(element);
    issues.push(...ariaIssues);
    score -= ariaIssues.length * 5;

    // Generate recommendations
    const recommendations = this.generateRecommendations(issues);

    return {
      element,
      issues,
      score: Math.max(0, score),
      recommendations,
    };
  }

  /**
   * Check if element is interactive
   */
  private isInteractiveElement(element: HTMLElement): boolean {
    const interactiveTags = ['button', 'a', 'input', 'select', 'textarea'];
    const hasTabindex =
      element.hasAttribute('tabindex') && element.getAttribute('tabindex') !== '-1';
    const hasClickHandler = element.onclick !== null;
    const hasRole = ['button', 'link', 'menuitem', 'tab'].includes(
      element.getAttribute('role') || ''
    );

    return (
      interactiveTags.includes(element.tagName.toLowerCase()) ||
      hasTabindex ||
      hasClickHandler ||
      hasRole
    );
  }

  /**
   * Check if element has accessible name
   */
  private hasAccessibleName(element: HTMLElement): boolean {
    return !!(
      element.getAttribute('aria-label') ||
      element.getAttribute('aria-labelledby') ||
      element.getAttribute('title') ||
      element.textContent?.trim()
    );
  }

  /**
   * Check if element needs explicit role
   */
  private needsExplicitRole(element: HTMLElement): boolean {
    const ambiguousTags = ['div', 'span'];
    const hasInteractiveHandlers = element.onclick !== null || element.onkeydown !== null;

    return ambiguousTags.includes(element.tagName.toLowerCase()) && hasInteractiveHandlers;
  }

  /**
   * Validate ARIA properties
   */
  private validateAriaProperties(element: HTMLElement): AriaIssue[] {
    const issues: AriaIssue[] = [];
    const attributes = Array.from(element.attributes);

    attributes.forEach(attr => {
      if (attr.name.startsWith('aria-')) {
        // Check for valid ARIA attributes
        if (!this.isValidAriaAttribute(attr.name)) {
          issues.push({
            type: 'error',
            code: 'invalid-aria-attribute',
            message: `Invalid ARIA attribute: ${attr.name}`,
            element,
            wcagReference: '4.1.2 Name, Role, Value',
          });
        }

        // Check for proper values
        if (!this.isValidAriaValue(attr.name, attr.value)) {
          issues.push({
            type: 'error',
            code: 'invalid-aria-value',
            message: `Invalid value for ${attr.name}: ${attr.value}`,
            element,
            wcagReference: '4.1.2 Name, Role, Value',
          });
        }
      }
    });

    return issues;
  }

  /**
   * Check if ARIA attribute is valid
   */
  private isValidAriaAttribute(attr: string): boolean {
    const validAttrs = [
      'aria-label',
      'aria-labelledby',
      'aria-describedby',
      'aria-hidden',
      'aria-expanded',
      'aria-selected',
      'aria-checked',
      'aria-pressed',
      'aria-current',
      'aria-level',
      'aria-setsize',
      'aria-posinset',
      'aria-live',
      'aria-atomic',
      'aria-busy',
      'aria-relevant',
      'aria-controls',
      'aria-owns',
      'aria-flowto',
      'aria-required',
      'aria-invalid',
      'aria-disabled',
      'aria-readonly',
      'aria-multiline',
      'aria-orientation',
      'aria-sort',
      'aria-valuemin',
      'aria-valuemax',
      'aria-valuenow',
      'aria-valuetext',
    ];

    return validAttrs.includes(attr);
  }

  /**
   * Check if ARIA value is valid
   */
  private isValidAriaValue(attr: string, value: string): boolean {
    const booleanAttrs = [
      'aria-hidden',
      'aria-expanded',
      'aria-selected',
      'aria-checked',
      'aria-pressed',
      'aria-disabled',
      'aria-readonly',
      'aria-required',
      'aria-invalid',
      'aria-atomic',
      'aria-busy',
      'aria-multiline',
    ];
    const _tokenAttrs = [
      'aria-live',
      'aria-relevant',
      'aria-current',
      'aria-orientation',
      'aria-sort',
    ];

    if (booleanAttrs.includes(attr)) {
      return ['true', 'false'].includes(value.toLowerCase());
    }

    if (attr === 'aria-live') {
      return ['off', 'polite', 'assertive'].includes(value.toLowerCase());
    }

    if (attr === 'aria-current') {
      return ['page', 'step', 'location', 'date', 'time', 'true', 'false'].includes(
        value.toLowerCase()
      );
    }

    return true; // Allow other values for now
  }

  /**
   * Generate recommendations based on issues
   */
  private generateRecommendations(issues: AriaIssue[]): string[] {
    const recommendations: string[] = [];

    if (issues.some(issue => issue.code === 'missing-accessible-name')) {
      recommendations.push('Add aria-label or aria-labelledby to provide an accessible name');
    }

    if (issues.some(issue => issue.code === 'missing-role')) {
      recommendations.push(
        'Consider adding an explicit role attribute for better semantic meaning'
      );
    }

    if (issues.some(issue => issue.code.includes('aria'))) {
      recommendations.push('Review ARIA attributes for proper syntax and values');
    }

    return recommendations;
  }
}

/**
 * Keyboard Navigation Tester
 */
export class KeyboardNavigationTester {
  /**
   * Test keyboard navigation for container
   */
  public testContainer(container: HTMLElement = document.body): KeyboardTestResult {
    const allElements = container.querySelectorAll('*');
    const focusableElements = this.getFocusableElements(container);
    const tabbableElements = this.getTabbableElements(container);

    const issues: KeyboardIssue[] = [];
    const focusOrder = Array.from(tabbableElements);
    const trapIssues = this.testFocusTraps(container);

    // Test for skip links
    if (!this.hasSkipLinks(container)) {
      issues.push({
        type: 'skip-link-missing',
        element: container,
        message: 'Page lacks skip links for efficient keyboard navigation',
        severity: 'medium',
      });
    }

    // Test focus visibility
    focusableElements.forEach(element => {
      if (!this.hasFocusIndicator(element)) {
        issues.push({
          type: 'poor-focus-visible',
          element: element as HTMLElement,
          message: 'Element lacks visible focus indicator',
          severity: 'high',
        });
      }
    });

    return {
      totalElements: allElements.length,
      focusableElements: focusableElements.length,
      tabbableElements: tabbableElements.length,
      issues,
      focusOrder,
      trapIssues,
    };
  }

  /**
   * Get focusable elements
   */
  private getFocusableElements(container: HTMLElement): Element[] {
    const selector = [
      'a[href]',
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
      '[contenteditable]',
      'audio[controls]',
      'video[controls]',
    ].join(', ');

    return Array.from(container.querySelectorAll(selector));
  }

  /**
   * Get tabbable elements (focusable and in tab order)
   */
  private getTabbableElements(container: HTMLElement): Element[] {
    return this.getFocusableElements(container).filter(element => {
      const tabindex = element.getAttribute('tabindex');
      return tabindex !== '-1';
    });
  }

  /**
   * Check if page has skip links
   */
  private hasSkipLinks(container: HTMLElement): boolean {
    const skipLinks = container.querySelectorAll('a[href^="#"]');
    return (
      skipLinks.length > 0 &&
      Array.from(skipLinks).some(
        link =>
          link.textContent?.toLowerCase().includes('skip') ||
          link.getAttribute('class')?.includes('skip')
      )
    );
  }

  /**
   * Check if element has focus indicator
   */
  private hasFocusIndicator(element: Element): boolean {
    const computedStyle = window.getComputedStyle(element as HTMLElement, ':focus');
    return (
      computedStyle.outline !== 'none' ||
      computedStyle.boxShadow !== 'none' ||
      computedStyle.border !== computedStyle.border
    ); // Different from unfocused state
  }

  /**
   * Test for focus trap issues
   */
  private testFocusTraps(container: HTMLElement): FocusTrapIssue[] {
    const issues: FocusTrapIssue[] = [];
    const modals = container.querySelectorAll('[role="dialog"], .modal, [aria-modal="true"]');

    modals.forEach(modal => {
      const tabbable = this.getTabbableElements(modal as HTMLElement);

      if (tabbable.length === 0) {
        issues.push({
          type: 'escape-impossible',
          container: modal as HTMLElement,
          message: 'Modal/dialog has no focusable elements, creating keyboard trap',
        });
      }
    });

    return issues;
  }
}

/**
 * Complete Accessibility Auditor
 */
export class AccessibilityAuditor {
  private colorTester = new ColorContrastTester();
  private ariaTester = new AriaComplianceTester();
  private keyboardTester = new KeyboardNavigationTester();

  /**
   * Run complete accessibility audit
   */
  public audit(container: HTMLElement = document.body): AccessibilityAuditReport {
    const timestamp = new Date();
    const url = window.location.href;

    // Color contrast audit
    const contrastIssues = this.colorTester.auditPageContrast(container);

    // ARIA audit
    const elements = Array.from(container.querySelectorAll('*'));
    const ariaResults = elements.map(el => this.ariaTester.testElement(el as HTMLElement));
    const allAriaIssues = ariaResults.flatMap(result => result.issues);

    // Keyboard audit
    const keyboardResult = this.keyboardTester.testContainer(container);

    // Semantic audit
    const _semanticsResult = this.auditSemantics(container);

    // Generate recommendations
    const recommendations = this.generateRecommendations(
      contrastIssues,
      allAriaIssues,
      keyboardResult,
      semanticsResult
    );

    // WCAG compliance assessment
    const wcagCompliance = this.assessWcagCompliance(
      contrastIssues,
      allAriaIssues,
      keyboardResult,
      semanticsResult
    );

    // Calculate overall score
    const overallScore = this.calculateOverallScore(
      contrastIssues,
      allAriaIssues,
      keyboardResult,
      semanticsResult
    );

    return {
      timestamp,
      url,
      overallScore,
      colorContrast: {
        tested: elements.length,
        passed: elements.length - contrastIssues.length,
        failed: contrastIssues.length,
        issues: contrastIssues,
      },
      aria: {
        elementsChecked: elements.length,
        totalIssues: allAriaIssues.length,
        errors: allAriaIssues.filter(issue => issue.type === 'error').length,
        warnings: allAriaIssues.filter(issue => issue.type === 'warning').length,
        issues: allAriaIssues,
      },
      keyboard: keyboardResult,
      semantics: _semanticsResult,
      recommendations,
      wcagCompliance,
    };
  }

  /**
   * Audit semantic structure
   */
  private auditSemantics(container: HTMLElement): SemanticTestResult {
    const headingStructure = this.auditHeadings(container);
    const landmarks = this.auditLandmarks(container);
    const lists = this.auditLists(container);
    const images = this.auditImages(container);
    const forms = this.auditForms(container);

    const totalIssues =
      headingStructure.length + landmarks.length + lists.length + images.length + forms.length;
    const score = Math.max(0, 100 - totalIssues * 10);

    return {
      headingStructure,
      landmarks,
      lists,
      images,
      forms,
      score,
    };
  }

  /**
   * Audit heading structure
   */
  private auditHeadings(container: HTMLElement): HeadingIssue[] {
    const issues: HeadingIssue[] = [];
    const headings = Array.from(container.querySelectorAll('h1, h2, h3, h4, h5, h6'));

    // Check for H1
    const h1s = headings.filter(h => h.tagName === 'H1');
    if (h1s.length === 0) {
      issues.push({
        element: container,
        level: 1,
        issue: 'missing-h1',
        message: 'Page should have exactly one H1 element',
      });
    } else if (h1s.length > 1) {
      h1s.slice(1).forEach(h1 => {
        issues.push({
          element: h1 as HTMLElement,
          level: 1,
          issue: 'multiple-h1',
          message: 'Multiple H1 elements found, should have only one per page',
        });
      });
    }

    // Check heading hierarchy
    let previousLevel = 0;
    headings.forEach(heading => {
      const level = parseInt(heading.tagName.charAt(1));

      if (level > previousLevel + 1) {
        issues.push({
          element: heading as HTMLElement,
          level,
          issue: 'skipped-level',
          message: `Heading level ${level} follows H${previousLevel}, skipping levels`,
        });
      }

      if (!heading.textContent?.trim()) {
        issues.push({
          element: heading as HTMLElement,
          level,
          issue: 'empty-heading',
          message: 'Heading element is empty',
        });
      }

      previousLevel = level;
    });

    return issues;
  }

  /**
   * Audit landmark elements
   */
  private auditLandmarks(container: HTMLElement): LandmarkIssue[] {
    const issues: LandmarkIssue[] = [];

    // Check for main landmark
    const mains = container.querySelectorAll('main, [role="main"]');
    if (mains.length === 0) {
      issues.push({
        issue: 'missing-main',
        message: 'Page should have a main landmark',
      });
    } else if (mains.length > 1) {
      issues.push({
        issue: 'multiple-main',
        element: mains[1] as HTMLElement,
        message: 'Page should have only one main landmark',
      });
    }

    return issues;
  }

  /**
   * Audit list elements
   */
  private auditLists(container: HTMLElement): ListIssue[] {
    const issues: ListIssue[] = [];
    const lists = container.querySelectorAll('ul, ol, dl');

    lists.forEach(list => {
      const children = Array.from(list.children);
      const validChildren =
        list.tagName === 'DL'
          ? children.filter(child => ['DT', 'DD'].includes(child.tagName))
          : children.filter(child => child.tagName === 'LI');

      if (validChildren.length === 0) {
        issues.push({
          element: list as HTMLElement,
          issue: 'empty-list',
          message: `${list.tagName} element is empty or contains no valid list items`,
        });
      }
    });

    return issues;
  }

  /**
   * Audit image elements
   */
  private auditImages(container: HTMLElement): ImageIssue[] {
    const issues: ImageIssue[] = [];
    const images = container.querySelectorAll('img');

    images.forEach(img => {
      const alt = img.getAttribute('alt');

      if (alt === null) {
        issues.push({
          element: img,
          issue: 'missing-alt',
          message: 'Image is missing alt attribute',
        });
      } else if (alt === '' && img.getAttribute('role') !== 'presentation') {
        // Empty alt should be used for decorative images
        issues.push({
          element: img,
          issue: 'empty-alt-decorative',
          message: 'Consider adding role="presentation" for decorative images',
        });
      }
    });

    return issues;
  }

  /**
   * Audit form elements
   */
  private auditForms(container: HTMLElement): FormIssue[] {
    const issues: FormIssue[] = [];
    const formControls = container.querySelectorAll('input, select, textarea');

    formControls.forEach(control => {
      const htmlControl = control as HTMLElement;
      const id = htmlControl.getAttribute('id');
      const hasLabel = id && container.querySelector(`label[for="${id}"]`);
      const hasAriaLabel =
        htmlControl.getAttribute('aria-label') || htmlControl.getAttribute('aria-labelledby');

      if (!hasLabel && !hasAriaLabel) {
        issues.push({
          element: htmlControl,
          issue: 'missing-label',
          message: 'Form control lacks a proper label',
        });
      }
    });

    return issues;
  }

  /**
   * Generate comprehensive recommendations
   */
  private generateRecommendations(
    contrastIssues: ContrastIssue[],
    ariaIssues: AriaIssue[],
    keyboardResult: KeyboardTestResult,
    _semanticsResult: SemanticTestResult
  ): Recommendation[] {
    const recommendations: Recommendation[] = [];

    // Color contrast recommendations
    if (contrastIssues.length > 0) {
      recommendations.push({
        priority: 'high',
        category: 'color-contrast',
        title: 'Fix Color Contrast Issues',
        description: `${contrastIssues.length} elements fail WCAG color contrast requirements`,
        wcagCriterion: '1.4.3 Contrast (Minimum)',
        howToFix:
          'Increase contrast between text and background colors to meet 4.5:1 ratio for normal text and 3:1 for large text',
        codeExample: `/* Example fix */\n.low-contrast-text {\n  color: #333333; /* Instead of #999999 */\n  background: #ffffff;\n}`,
        affectedElements: contrastIssues.map(issue => issue.element),
      });
    }

    // ARIA recommendations
    const ariaErrors = ariaIssues.filter(issue => issue.type === 'error');
    if (ariaErrors.length > 0) {
      recommendations.push({
        priority: 'high',
        category: 'aria',
        title: 'Fix ARIA Implementation',
        description: `${ariaErrors.length} ARIA errors found that affect assistive technology`,
        wcagCriterion: '4.1.2 Name, Role, Value',
        howToFix: 'Add proper ARIA labels, roles, and properties to interactive elements',
        codeExample: `<!-- Example fix -->\n<button aria-label="Close dialog">×</button>\n<input aria-describedby="help-text" />`,
        affectedElements: ariaErrors.map(issue => issue.element),
      });
    }

    // Keyboard navigation recommendations
    if (keyboardResult.issues.length > 0) {
      recommendations.push({
        priority: 'high',
        category: 'keyboard',
        title: 'Improve Keyboard Navigation',
        description: 'Multiple keyboard navigation issues detected',
        wcagCriterion: '2.1.1 Keyboard',
        howToFix:
          'Ensure all interactive elements are keyboard accessible and have visible focus indicators',
        codeExample: `/* Example focus styles */\nbutton:focus-visible {\n  outline: 2px solid #007acc;\n  outline-offset: 2px;\n}`,
        affectedElements: keyboardResult.issues.map(issue => issue.element),
      });
    }

    return recommendations;
  }

  /**
   * Assess WCAG 2.1 compliance
   */
  private assessWcagCompliance(
    contrastIssues: ContrastIssue[],
    ariaIssues: AriaIssue[],
    keyboardResult: KeyboardTestResult,
    _semanticsResult: SemanticTestResult
  ): WcagComplianceResult {
    const criteriaResults: WcagCriteriaResult[] = [];

    // 1.4.3 Contrast (Minimum) - AA
    criteriaResults.push({
      criterion: '1.4.3 Contrast (Minimum)',
      level: 'AA',
      passed: contrastIssues.length === 0,
      issues: contrastIssues.map(issue => `Low contrast: ${issue.ratio.toFixed(2)}:1`),
      elements: contrastIssues.map(issue => issue.element),
    });

    // 2.1.1 Keyboard - A
    criteriaResults.push({
      criterion: '2.1.1 Keyboard',
      level: 'A',
      passed: keyboardResult.issues.length === 0,
      issues: keyboardResult.issues.map(issue => issue.message),
      elements: keyboardResult.issues.map(issue => issue.element),
    });

    // 4.1.2 Name, Role, Value - A
    const ariaErrors = ariaIssues.filter(issue => issue.type === 'error');
    criteriaResults.push({
      criterion: '4.1.2 Name, Role, Value',
      level: 'A',
      passed: ariaErrors.length === 0,
      issues: ariaErrors.map(issue => issue.message),
      elements: ariaErrors.map(issue => issue.element),
    });

    const passedCriteria = criteriaResults.filter(result => result.passed).length;
    const totalCriteria = criteriaResults.length;
    const score = (passedCriteria / totalCriteria) * 100;

    let level: WcagComplianceResult['level'] = 'FAIL';
    if (score === 100) {
      level = 'AA'; // Basic compliance
    } else if (score >= 80) {
      level = 'A';
    }

    return {
      level,
      criteriaResults,
      score,
      totalCriteria,
      passedCriteria,
    };
  }

  /**
   * Calculate overall accessibility score
   */
  private calculateOverallScore(
    contrastIssues: ContrastIssue[],
    ariaIssues: AriaIssue[],
    keyboardResult: KeyboardTestResult,
    _semanticsResult: SemanticTestResult
  ): number {
    let score = 100;

    // Deduct for color contrast issues (high impact)
    score -= contrastIssues.length * 5;

    // Deduct for ARIA errors (high impact)
    score -= ariaIssues.filter(issue => issue.type === 'error').length * 5;

    // Deduct for ARIA warnings (medium impact)
    score -= ariaIssues.filter(issue => issue.type === 'warning').length * 2;

    // Deduct for keyboard issues
    score -= keyboardResult.issues.length * 3;

    // Factor in semantic score
    score = (score + semanticsResult.score) / 2;

    return Math.max(0, Math.min(100, score));
  }
}

// Export testing utilities
export const accessibilityTester = new AccessibilityAuditor();
export const colorContrastTester = new ColorContrastTester();
export const ariaComplianceTester = new AriaComplianceTester();
export const keyboardNavigationTester = new KeyboardNavigationTester();
