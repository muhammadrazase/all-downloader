import { getSetting } from './config/settings.server';

export interface BankTransferDetails {
  accountTitle: string;
  accountNumber: string;
  iban: string;
  swiftCode: string;
  bankName: string;
  branchName: string;
  branchCode: string;
}

const FIELDS = {
  accountTitle: 'SUPPORT_BANK_ACCOUNT_TITLE',
  accountNumber: 'SUPPORT_BANK_ACCOUNT_NUMBER',
  iban: 'SUPPORT_BANK_IBAN',
  swiftCode: 'SUPPORT_BANK_SWIFT_CODE',
  bankName: 'SUPPORT_BANK_NAME',
  branchName: 'SUPPORT_BANK_BRANCH_NAME',
  branchCode: 'SUPPORT_BANK_BRANCH_CODE',
} as const;

/**
 * Manual wire-transfer fallback for the support widget — not a secret (an
 * IBAN/account number is meant to be handed out to anyone who wants to pay
 * into it, unlike an API key), so these settings are stored unencrypted.
 * Requires the account number and IBAN at minimum; the rest fill in gaps.
 */
export function getBankTransferDetails(): BankTransferDetails | null {
  const accountNumber = getSetting(FIELDS.accountNumber);
  const iban = getSetting(FIELDS.iban);
  if (!accountNumber || !iban) return null;

  return {
    accountTitle: getSetting(FIELDS.accountTitle) || '',
    accountNumber,
    iban,
    swiftCode: getSetting(FIELDS.swiftCode) || '',
    bankName: getSetting(FIELDS.bankName) || '',
    branchName: getSetting(FIELDS.branchName) || '',
    branchCode: getSetting(FIELDS.branchCode) || '',
  };
}

export const BANK_TRANSFER_SETTING_KEYS = FIELDS;
