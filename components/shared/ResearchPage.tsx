'use client'

import React from 'react'

interface ResearchPageProps {
  children: React.ReactNode
  /** Optional fixed footer (e.g. Continue / Submit controls). */
  footer?: React.ReactNode
  /** Constrains the reading column width. Defaults to a comfortable measure. */
  maxWidthClassName?: string
  'data-testid'?: string
}

/**
 * Full-browser, responsive research page used for all non-interactive study
 * pages (consent, study introduction, assigned scenario, task instructions,
 * questionnaires, attention-check messages, completion / termination).
 *
 * Renders a centered content container with comfortable reading width,
 * clear spacing, and accessible controls — never inside the mobile-phone
 * frame.
 */
export default function ResearchPage({
  children,
  footer,
  maxWidthClassName = 'max-w-[680px]',
  ...rest
}: ResearchPageProps) {
  return (
    <div className="research-stage" data-testid={rest['data-testid']}>
      <div className={`research-container ${maxWidthClassName}`}>
        <div className="research-content">{children}</div>
        {footer && <div className="research-footer">{footer}</div>}
      </div>
    </div>
  )
}
