import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore'; // Timestamp をインポート
import { redirect } from 'react-router-dom';
// --- Firebase & Helper Function for Loader ---
// SignInRoutes と同じヘルパー関数を使うか、必要なら保護ルート用に調整
import { auth, db } from '@/firebase';
import { SerializedBankPaymentInfo, SerializedFirstMonthDiscount } from '@/store/reducers/auth';
import { StripeSubscriptionStatus, UserFirestoreData } from '@/types/auth'; // Import StripeSubscriptionStatus

// 保護ルート用の認証・規約チェックヘルパー
const checkAuthStatusForProtected = async (): Promise<{
  isAuthenticated: boolean;
  termsAccepted: boolean | null; // null: 未取得/エラー
  isAdmin: boolean; // 管理者フラグ
  updatedAt: string | null;
  createdAt: string | null;
  // user: User | null; // user は返り値の最後に追加するため、ここではコメントアウトまたは削除
  bankPaymentInfo: SerializedBankPaymentInfo | null;
  firstMonthDiscount: SerializedFirstMonthDiscount | null;
  subscriptionStatus: StripeSubscriptionStatus | null; // Use StripeSubscriptionStatus type
  planId: string | null; // 現在のプランID
  currentPeriodStart: string | null; // Firestore Timestamp
  currentPeriodEnd: string | null;
  stripePriceId: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  canceledAtPeriodEnd: boolean;
  canceledAt: string | null;
  pendingPlanChange: {
    fromPlanId: string | null;
    toPlanId: string | null;
    effectiveDate: string | null; // Firestore Timestamp
  } | null;
  endedAt: string | null; // サブスクリプションの終了日
  // 現在の期間終了日 (Firestore Timestamp)
  user: User | null; // ユーザー情報も返す
}> => {
  // SignInRoutes.tsx の checkAuthStatusForGuest とほぼ同じロジック
  // user情報も返すように変更
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      unsubscribe();
      if (user) {
        try {
          const userDocRef = doc(db, 'users', user.uid);
          const userDocSnap = await getDoc(userDocRef);
          if (userDocSnap.exists()) {
            const userData = userDocSnap.data() as UserFirestoreData;
            const accepted =
              typeof userData.termsAccepted === 'boolean' ? userData.termsAccepted : false;
            const isAdmin = userData.isAdmin || false; // 管理者フラグを取得
            const updatedAt = userData.updatedAt ? userData.updatedAt.toDate().toISOString() : null;
            const createdAt = userData.createdAt ? userData.createdAt.toDate().toISOString() : null;
            let resolveBankPaymentInfo = null;
            if (userData.bankPaymentInfo) {
              const validStatuses = [
                'payment_requested',
                'payment_confirmed',
                'payment_expired',
                'payment_rejected',
                'payment_failed',
                'payment_canceled',
                'pending_confirmation',
                'renewal_requested',
                'renewal_pending_confirmation',
              ] as const;
              type BankPaymentStatus = (typeof validStatuses)[number];

              let currentStatus: BankPaymentStatus = 'payment_requested'; // デフォルト値
              if (
                userData.bankPaymentInfo.status &&
                validStatuses.includes(userData.bankPaymentInfo.status as BankPaymentStatus)
              ) {
                currentStatus = userData.bankPaymentInfo.status as BankPaymentStatus;
              } else if (userData.bankPaymentInfo.status) {
                // ログには残すが、デフォルト値を使用
                console.warn(
                  `Invalid bankPaymentInfo.status: ${userData.bankPaymentInfo.status}. Defaulting to 'payment_requested'.`
                );
              }

              resolveBankPaymentInfo = {
                amount: userData.bankPaymentInfo.amount ? userData.bankPaymentInfo.amount : 0,
                baseAmount: userData.bankPaymentInfo.baseAmount,
                feeAmount: userData.bankPaymentInfo.feeAmount,
                discountAmount: userData.bankPaymentInfo.discountAmount,
                referralCreditAppliedAmount: userData.bankPaymentInfo.referralCreditAppliedAmount,
                totalAmount: userData.bankPaymentInfo.totalAmount,
                firstMonthDiscountApplied: userData.bankPaymentInfo.firstMonthDiscountApplied,
                currency: userData.bankPaymentInfo.currency
                  ? userData.bankPaymentInfo.currency
                  : '',
                status: currentStatus,
                planId: userData.bankPaymentInfo.planId ? userData.bankPaymentInfo.planId : '',
                planName: userData.bankPaymentInfo.planName
                  ? userData.bankPaymentInfo.planName
                  : '',
                requestedAt: userData.bankPaymentInfo.requestedAt
                  ? userData.bankPaymentInfo.requestedAt.toDate().toISOString()
                  : '',
                paymentDeadline: userData.bankPaymentInfo.paymentDeadline
                  ? userData.bankPaymentInfo.paymentDeadline.toDate().toISOString()
                  : '',
                rejectionReason: userData.bankPaymentInfo.rejectionReason,
                rejectedAt: userData.bankPaymentInfo.rejectedAt
                  ? userData.bankPaymentInfo.rejectedAt.toDate().toISOString()
                  : undefined,
                rejectedRequestId: userData.bankPaymentInfo.rejectedRequestId,
              };
            }

            // サブスクリプションステータスを取得 (存在しない場合は 'inactive' や null など適切に処理)
            // Ensure subStatus aligns with StripeSubscriptionStatus
            console.log(`【stripeCustomerId】:${userData.stripeCustomerId}`);
            const stripeCustomerId = userData.stripeCustomerId || null;
            const stripeSubscriptionId = userData.stripeSubscriptionId || null;
            const subStatus: StripeSubscriptionStatus = userData.subscriptionStatus || 'inactive';
            const currentPlanId = userData.appPlanId || null;
            const periodStart = userData.currentPeriodStart?.toDate().toISOString() || null;
            const periodEnd = userData.currentPeriodEnd?.toDate().toISOString() || null;
            const canceledAtPeriodEnd = userData.cancelAtPeriodEnd || false;
            const canceledAt = userData.canceledAt?.toDate().toISOString() || null;
            const endedAt = userData.endedAt ? userData.endedAt.toDate().toISOString() : null;
            const stripePriceId = userData.stripePriceId || null;
            const pendingPlanChangeData = {
              fromPlanId: userData.pendingPlanChange?.fromPlanId || null,
              toPlanId: userData.pendingPlanChange?.toPlanId || null,
              effectiveDate: userData.pendingPlanChange?.effectiveDate
                ? userData.pendingPlanChange.effectiveDate.toDate().toISOString()
                : null,
            };
            const firstMonthDiscount = userData.firstMonthDiscount
              ? {
                  ...userData.firstMonthDiscount,
                  eligibleAt: userData.firstMonthDiscount.eligibleAt
                    ? userData.firstMonthDiscount.eligibleAt.toDate().toISOString()
                    : null,
                  expiresAt: userData.firstMonthDiscount.expiresAt
                    ? userData.firstMonthDiscount.expiresAt.toDate().toISOString()
                    : null,
                  redeemedAt: userData.firstMonthDiscount.redeemedAt
                    ? userData.firstMonthDiscount.redeemedAt.toDate().toISOString()
                    : null,
                }
              : null;

            // 未設定の場合に false を書き込む処理は listenAuthState に任せる方が一貫性があるかも
            // if (typeof userData.termsAccepted !== 'boolean') {
            //     console.warn(`Firestore document for user ${user.uid} missing termsAccepted field in protected loader. Assuming false.`);
            // }
            console.log(`appPlanId: ${currentPlanId}`);
            resolve({
              isAuthenticated: true,
              termsAccepted: accepted,
              isAdmin,
              updatedAt,
              createdAt,
              bankPaymentInfo: resolveBankPaymentInfo,
              firstMonthDiscount,
              stripeCustomerId,
              stripeSubscriptionId,
              subscriptionStatus: subStatus,
              planId: currentPlanId,
              currentPeriodStart: periodStart,
              currentPeriodEnd: periodEnd,
              stripePriceId,
              canceledAtPeriodEnd,
              canceledAt,
              user, // user を追加
              endedAt,
              pendingPlanChange: pendingPlanChangeData,
            });
          } else {
            console.warn(`Firestore document not found for user ${user.uid} in protected loader.`);
            // Firestoreにデータがない場合、未同意・未加入扱い
            resolve({
              isAuthenticated: true,
              termsAccepted: false,
              updatedAt: null,
              createdAt: null,
              bankPaymentInfo: null,
              firstMonthDiscount: null,
              isAdmin: false,
              subscriptionStatus: 'inactive', // Default to 'inactive'
              planId: null,
              currentPeriodStart: null,
              currentPeriodEnd: null,
              stripePriceId: null,
              stripeCustomerId: null,
              stripeSubscriptionId: null,
              canceledAtPeriodEnd: false,
              canceledAt: null,
              endedAt: null,
              user,
              pendingPlanChange: null,
            });
          }
        } catch (error) {
          console.error('Error fetching Firestore data in protected loader:', error);
          // エラー時は規約・サブスクリプション不明
          resolve({
            isAuthenticated: true,
            termsAccepted: null,
            updatedAt: null,
            createdAt: null,
            bankPaymentInfo: null,
            firstMonthDiscount: null,
            isAdmin: false,
            subscriptionStatus: null,
            planId: null,
            currentPeriodStart: null,
            currentPeriodEnd: null,
            stripePriceId: null,
            stripeCustomerId: null,
            stripeSubscriptionId: null,
            canceledAtPeriodEnd: false,
            canceledAt: null,
            endedAt: null,
            user,
            pendingPlanChange: null,
          });
        }
      } else {
        resolve({
          isAuthenticated: false,
          termsAccepted: null,
          updatedAt: null,
          createdAt: null,
          bankPaymentInfo: null,
          firstMonthDiscount: null,
          isAdmin: false,
          subscriptionStatus: null,
          planId: null,
          currentPeriodStart: null,
          currentPeriodEnd: null,
          stripePriceId: null,
          stripeCustomerId: null,
          stripeSubscriptionId: null,
          canceledAtPeriodEnd: false,
          canceledAt: null,
          endedAt: null,
          user: null,
          pendingPlanChange: null,
        }); // 未認証
      }
    });
  });
};

// --- Loader Function for Protected Routes ---
export const protectedLoader = async ({ request }: { request: Request }) => {
  // ★★★ このログが本当に出力されないか確認 ★★★
  console.log('--- protectedLoader CALLED ---');
  const {
    isAuthenticated,
    termsAccepted,
    isAdmin,
    subscriptionStatus,
    planId,
    currentPeriodEnd,
    user,
    canceledAtPeriodEnd,
    canceledAt,
    endedAt,
    pendingPlanChange,
    stripeCustomerId,
    bankPaymentInfo,
    firstMonthDiscount,
  } = await checkAuthStatusForProtected();
  const currentPath = new URL(request.url).pathname; // ★ アクセス先のパスを取得
  console.log(
    `[protectedLoader] Path: ${currentPath} - isAuthenticated: ${isAuthenticated}, termsAccepted: ${termsAccepted}, subscriptionStatus: ${subscriptionStatus}, planId: ${planId}, userUID: ${user?.uid}`
  );

  if (!isAuthenticated) {
    // 未認証ならログインページへリダイレクト (元のパスをクエリパラメータで渡す)
    const params = new URLSearchParams();
    const currentPath = new URL(request.url).pathname;
    // ログインページやAPIエンドポイントなど、無限ループしそうなパスはfromに含めない方が良いかも
    if (currentPath !== '/auth/signin') {
      // パスを /auth/signin に修正
      params.set('from', currentPath);
    }
    console.log('[protectedLoader] Not authenticated. Redirecting to /auth/signin');
    return redirect(`/auth/signin?${params.toString()}`); // パスを /auth/signin に修正
  }

  if (termsAccepted === false) {
    // ★ アクセスしようとしているパスが '/terms' でなければ、'/terms' へリダイレクト
    if (currentPath !== '/terms') {
      console.log('protectedLoader: Authenticated but terms not accepted. Redirecting to /terms');
      return redirect('/terms'); // Redirect and stop further execution
    }
    // ★ アクセスしようとしているパスが '/terms' の場合は、リダイレクトせずに表示を許可
    console.log(
      'protectedLoader: Accessing /terms while terms not accepted. Allowing access to TermsPage.'
    );
    // For /terms page, even if terms not accepted, we need to show it.
    // It might need user data if the TermsPage component uses it.
    return { user };
  }

  if (termsAccepted === null) {
    // 規約同意状態が不明 (エラーなど) の場合
    console.error(
      'protectedLoader: Terms acceptance status is null. Redirecting to /signin as a fallback.'
    );
    // 安全のためログインページに戻すか、エラーページを表示
    return redirect('/auth/signin'); // フォールバック先も /auth/signin に修正
  }

  // 認証済み & 規約同意済みの場合、次にサブスクリプション状態をチェック
  const activeSubscriptionStatuses: StripeSubscriptionStatus[] = ['active', 'trialing'];
  // Define paths that are always allowed, e.g., to manage subscription or view terms.
  // '/profile' often contains subscription management.
  // '/subscription' is where we redirect users with inactive subscriptions.
  // Updated: Only /profile and /terms are allowed for inactive subscription status.
  const alwaysAllowedPaths = ['/profile', '/terms'];

  const isSubscriptionActiveOrTrialing = activeSubscriptionStatuses.includes(subscriptionStatus);
  const isPathAlwaysAllowed = alwaysAllowedPaths.includes(currentPath);

  console.log(
    `[protectedLoader] Pre-check: subscriptionStatus='${subscriptionStatus}', isSubscriptionActiveOrTrialing=${isSubscriptionActiveOrTrialing}`
  );
  console.log(
    `[protectedLoader] Pre-check: currentPath='${currentPath}', isPathAlwaysAllowed=${isPathAlwaysAllowed}`
  );

  if (
    !isSubscriptionActiveOrTrialing && // Condition A
    !isPathAlwaysAllowed // Condition B
  ) {
    // If subscription is not active/trialing AND the user is not trying to access an allowed page
    console.log(
      `[protectedLoader] Condition MET: !(${isSubscriptionActiveOrTrialing}) && !(${isPathAlwaysAllowed}). Redirecting to /profile.`
    );
    return redirect('/profile?reason=inactive_subscription'); // Redirect to /profile
  }
  console.log(
    `[protectedLoader] Condition NOT MET for subscription redirect: !(${isSubscriptionActiveOrTrialing}) && !(${isPathAlwaysAllowed}) is false. Proceeding.`
  );

  console.log(`[protectedLoader] Access GRANTED for path '${currentPath}'. Returning data.`);
  // ページコンポーネントに必要なデータを返す (任意)
  // この例では user オブジェクトを返すが、Reduxから取得できるなら不要な場合も多い
  const returnData = {
    user,
    termsAccepted,
    isAdmin,
    subscriptionStatus,
    planId,
    currentPeriodEnd,
    canceledAtPeriodEnd,
    canceledAt,
    endedAt,
    pendingPlanChange,
    bankPaymentInfo,
    firstMonthDiscount,
    stripeCustomerId,
  };
  console.log(
    '[protectedLoader] Data being returned:',
    JSON.stringify(
      returnData,
      (key, value) => {
        if (key === 'user' && value && typeof value === 'object' && 'uid' in value) {
          return { uid: value.uid, email: value.email, displayName: value.displayName };
        } // Serialize user minimally
        return value;
      },
      2
    )
  );
  return returnData;
};
