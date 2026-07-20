export type AutomationLayer =
  | 'app-e2e'
  | 'firebase-state'
  | 'external-console'
  | 'operator-assisted'
  | 'manual';

export type AutomationStatus = 'automated' | 'candidate' | 'assisted' | 'manual';

export type ChecklistCase = {
  id: string;
  title: string;
  source: 'docs/user-operation-test-checklist.md' | 'docs/firebase-state-checklist.md';
  layer: AutomationLayer;
  status: AutomationStatus;
  spec?: string;
  notes?: string;
};

export const operationChecklist: ChecklistCase[] = [
  {
    id: '1-1',
    title: 'サインイン画面表示',
    source: 'docs/user-operation-test-checklist.md',
    layer: 'app-e2e',
    status: 'automated',
    spec: 'tests/operation/specs/auth-and-routing.spec.ts',
  },
  {
    id: '1-2',
    title: 'Googleサインイン開始',
    source: 'docs/user-operation-test-checklist.md',
    layer: 'operator-assisted',
    status: 'assisted',
    notes: 'Google認可画面、2FA、CAPTCHAは手動確認を残す。',
  },
  {
    id: '1-4',
    title: '初期ユーザーデータ作成',
    source: 'docs/user-operation-test-checklist.md',
    layer: 'firebase-state',
    status: 'candidate',
    spec: 'tests/operation/specs/firebase-state.spec.ts',
  },
  {
    id: '1-7',
    title: '利用規約同意前制御',
    source: 'docs/user-operation-test-checklist.md',
    layer: 'app-e2e',
    status: 'candidate',
    spec: 'tests/operation/specs/auth-and-routing.spec.ts',
  },
  {
    id: '1-8',
    title: '利用規約同意',
    source: 'docs/user-operation-test-checklist.md',
    layer: 'app-e2e',
    status: 'candidate',
    spec: 'tests/operation/specs/auth-and-routing.spec.ts',
    notes: 'ログイン済み storageState を用意した後に有効化する。',
  },
  {
    id: '1-9',
    title: '初回割引の期限',
    source: 'docs/user-operation-test-checklist.md',
    layer: 'firebase-state',
    status: 'candidate',
    spec: 'tests/operation/specs/firebase-state.spec.ts',
  },
  {
    id: '2-1',
    title: '未契約時の制限',
    source: 'docs/user-operation-test-checklist.md',
    layer: 'app-e2e',
    status: 'automated',
    spec: 'tests/operation/specs/auth-and-routing.spec.ts',
  },
  {
    id: '2-3',
    title: 'プラン表示',
    source: 'docs/user-operation-test-checklist.md',
    layer: 'app-e2e',
    status: 'candidate',
    notes: '未契約ユーザーの storageState を用意した後にUI文言と価格を検証する。',
  },
  {
    id: '3-1',
    title: 'Stripe申込開始',
    source: 'docs/user-operation-test-checklist.md',
    layer: 'external-console',
    status: 'assisted',
    notes: 'Stripe Checkout遷移までは自動化し、決済画面はテストカード入力の専用specで扱う。',
  },
  {
    id: '4-1',
    title: '銀行振込申込開始',
    source: 'docs/user-operation-test-checklist.md',
    layer: 'app-e2e',
    status: 'candidate',
    notes: '未契約ユーザーの storageState を用意した後にモーダル表示を検証する。',
  },
  {
    id: '5-2',
    title: 'GAS本人確認コード生成',
    source: 'docs/user-operation-test-checklist.md',
    layer: 'operator-assisted',
    status: 'assisted',
    notes: 'Spreadsheetメニュー操作は人間の確認待ちステップとして扱う。',
  },
  {
    id: '13-8',
    title: 'GAS URL直接更新拒否',
    source: 'docs/user-operation-test-checklist.md',
    layer: 'firebase-state',
    status: 'candidate',
    spec: 'tests/operation/specs/firebase-state.spec.ts',
  },
  {
    id: '18-4',
    title: 'Stripe契約報酬',
    source: 'docs/user-operation-test-checklist.md',
    layer: 'firebase-state',
    status: 'candidate',
    spec: 'tests/operation/specs/referral-rewards.spec.ts',
    notes: 'OPERATION_REFERRAL_REFERRER_UID と OPERATION_REFERRAL_REFERRED_UID を指定して報酬確定状態を確認する。',
  },
  {
    id: '18-7',
    title: 'マイルストーン',
    source: 'docs/user-operation-test-checklist.md',
    layer: 'firebase-state',
    status: 'candidate',
    spec: 'tests/operation/specs/referral-rewards.spec.ts',
    notes: 'OPERATION_REFERRAL_REFERRER_UID を指定して1/5/10/30/50/100人報酬の作成状態を確認する。',
  },
  {
    id: '18-8',
    title: '二重報酬防止',
    source: 'docs/user-operation-test-checklist.md',
    layer: 'firebase-state',
    status: 'candidate',
    spec: 'tests/operation/specs/referral-rewards.spec.ts',
    notes: 'OPERATION_REFERRAL_REFERRED_UID の referralQualifications が単一ドキュメントで保持されることを確認する。',
  },
  {
    id: '18-9',
    title: '100人達成時のStripe停止',
    source: 'docs/user-operation-test-checklist.md',
    layer: 'firebase-state',
    status: 'candidate',
    spec: 'tests/operation/specs/referral-rewards.spec.ts',
    notes: 'OPERATION_REFERRAL_REFERRER_UID を指定してlifetime化、Stripe契約ID削除、通知メールキューを確認する。',
  },
  {
    id: 'firebase-0.1',
    title: 'クライアントから直接変更できない重要フィールド',
    source: 'docs/firebase-state-checklist.md',
    layer: 'firebase-state',
    status: 'candidate',
    spec: 'tests/operation/specs/firebase-state.spec.ts',
  },
];

export const getChecklistCase = (id: string): ChecklistCase => {
  const item = operationChecklist.find((checklistCase) => checklistCase.id === id);

  if (!item) {
    throw new Error(`Operation checklist case is not registered: ${id}`);
  }

  return item;
};
