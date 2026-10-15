import React from 'react'

interface AddressTextProps {
  children: string
  underlineAddresses?: boolean
  underlineSecondaryAddress?: boolean
}

const STUDY_ADDRESSES = [
  '1000 Saint-Catherine Street West',
  '3008 Rue McGill',
] as const

const ADDRESS_PATTERN = /(1000 Saint-Catherine Street West|3008 Rue McGill)/g

/** Emphasizes the study's task addresses without changing contract-owned copy. */
export default function AddressText({
  children,
  underlineAddresses = true,
  underlineSecondaryAddress = true,
}: AddressTextProps) {
  return (
    <>
      {children.split(ADDRESS_PATTERN).map((part, index) => {
        const isStudyAddress = STUDY_ADDRESSES.some((address) => address === part)
        const shouldUnderline =
          underlineAddresses &&
          (part === '1000 Saint-Catherine Street West' ||
            (part === '3008 Rue McGill' && underlineSecondaryAddress))

        return isStudyAddress ? (
          <strong
            key={`${part}-${index}`}
            data-address-emphasis
            className={
              shouldUnderline
                ? 'font-bold underline decoration-2 underline-offset-2'
                : 'font-bold no-underline'
            }
          >
            {part}
          </strong>
        ) : (
          part
        )
      })}
    </>
  )
}
