'use client'

import React, { useEffect, useState } from 'react'
import StatusBar from '../shared/StatusBar'
import { logger } from '@/lib/logger'

/**
 * Consent screen shown at the very beginning of the study, before the
 * background questionnaire and the prototype tasks.
 *
 * Content adapted from page 1 of:
 *   docs/0613/Appendix_D_SuperApp_Questionnaire_HEC_06102026.docx
 *   ("INSTRUCTIONS INCLUDED WITH AN ANONYMOUS QUESTIONNAIRE")
 *
 * Participants must explicitly acknowledge consent before continuing.
 */

interface ConsentScreenProps {
  onConsent: () => void
}

export default function ConsentScreen({ onConsent }: ConsentScreenProps) {
  const [acknowledged, setAcknowledged] = useState(false)

  useEffect(() => {
    logger.trackEvent('consent.viewed', 'onboarding', 'consent_active')
  }, [])

  const handleContinue = () => {
    if (!acknowledged) return
    logger.trackEvent('consent.accepted', 'onboarding', 'consent_complete')
    onConsent()
  }

  return (
    <div className="relative w-full min-h-full bg-white flex flex-col animate-fade-in">
      <StatusBar />

      <div className="flex-1 overflow-y-auto px-5 pt-[72px] pb-8 no-scrollbar">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-[24px] font-bold tracking-tight text-black mb-2">
            Consent to Participate
          </h1>
          <p className="text-[14px] text-gray-500 leading-relaxed">
            Research project: <span className="font-semibold text-gray-700">User Experiences with Super Apps</span>
          </p>
        </div>

        {/* Sections */}
        <div className="space-y-5 text-[13.5px] leading-relaxed text-gray-700">
          <section>
            <h2 className="text-[13px] font-bold text-black uppercase tracking-wider mb-1.5">
              About this study
            </h2>
            <p>
              This study examines users&rsquo; experiences when moving between related services in a
              fictional super app. You will complete two short prototype tasks and answer a
              questionnaire about your experience. The questionnaire was developed as part of a
              master&rsquo;s thesis at HEC Montr&eacute;al. We estimate it should take about 5 minutes.
              Since your first impressions best reflect your true opinions, please answer without
              hesitation. There is no time limit.
            </p>
          </section>

          <section>
            <h2 className="text-[13px] font-bold text-black uppercase tracking-wider mb-1.5">
              Confidentiality
            </h2>
            <p>
              The information collected will be anonymous and will remain strictly confidential. It
              will be used solely for the advancement of knowledge and the dissemination of overall
              results in academic or professional forums. The online data collection provider agrees
              not to disclose any personal information about participants to any other users or third
              party, unless you expressly agree or unless required by law.
            </p>
          </section>

          <section>
            <h2 className="text-[13px] font-bold text-black uppercase tracking-wider mb-1.5">
              Voluntary participation
            </h2>
            <p>
              You are free to refuse to participate and may stop answering the questions at any time.
              By completing this questionnaire, you are considered to have given your consent to
              participate and to the potential use of the collected data in future research. Because
              the questionnaire is anonymous, once it is completed it will not be feasible to remove
              your data from the data set, as it will not be possible to determine which data are
              yours.
            </p>
          </section>

          <section>
            <h2 className="text-[13px] font-bold text-black uppercase tracking-wider mb-1.5">
              Contact
            </h2>
            <p>
              Principal investigator: Ran Zheng, Master&rsquo;s student, HEC Montr&eacute;al &mdash;{' '}
              <span className="font-medium text-gray-800">ran.zheng@hec.ca</span>.
            </p>
            <p className="mt-2">
              HEC Montr&eacute;al&rsquo;s Research Ethics Board has determined that the data collection
              related to this study meets the ethics standards for research involving humans. For
              questions related to ethics, contact the REB secretariat at{' '}
              <span className="font-medium text-gray-800">(514) 340-6051</span> or{' '}
              <span className="font-medium text-gray-800">cer@hec.ca</span>.
            </p>
          </section>
        </div>

        {/* Acknowledgement */}
        <button
          type="button"
          onClick={() => setAcknowledged((prev) => !prev)}
          data-testid="consent-acknowledge"
          aria-pressed={acknowledged}
          className="mt-7 w-full flex items-start gap-3 text-left px-4 py-3 rounded-[12px] border border-gray-200 bg-gray-50 active:scale-[0.99] transition-all"
        >
          <span
            className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-[6px] border-2 flex items-center justify-center transition-colors ${
              acknowledged ? 'bg-black border-black' : 'bg-white border-gray-300'
            }`}
          >
            {acknowledged && (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
          </span>
          <span className="text-[13.5px] font-medium text-gray-800 leading-snug">
            I have read and understood the information above, and I consent to participate.
          </span>
        </button>
      </div>

      {/* Continue */}
      <div className="sticky bottom-0 w-full p-4 bg-white/95 backdrop-blur-xl border-t border-gray-100 z-50 pb-[34px]">
        <button
          onClick={handleContinue}
          disabled={!acknowledged}
          data-testid="btn-consent-continue"
          className={`w-full h-[54px] rounded-[16px] font-bold text-[17px] shadow-lg transition-all active:scale-[0.97] flex items-center justify-center ${
            acknowledged
              ? 'bg-black text-white hover:bg-gray-900'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none'
          }`}
        >
          I Consent &mdash; Continue
        </button>
      </div>
    </div>
  )
}
