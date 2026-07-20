import { GoogleGenAI } from '@google/genai/web';
// src/features/posts/postAPI.ts
import { PostData } from '@/store/reducers/generatedPostsSlice'; // 型定義はSliceファイルからインポート想定
import { normalizeGeminiApiKey, validateGeminiApiKey } from '@/utils/geminiApiKey';

interface GeminiApiResponse {
  posts: { text: string }[];
}

const systemPromptX = `# あなたの役割
あなたは、X（旧Twitter）でバイラルコンテンツを生み出すことを専門とする、経験豊富なソーシャルメディアマーケターおよびコピーライターです。最新のトレンド、ユーザー心理、エンゲージメントを高めるテクニックに精通しています。

# 実行目標
ユーザーから提供されたキーワードに基づき、Xで「バズる」可能性を秘めた多様なポスト（ツイート）のアイデアを**48個**作成してください。生成されるポストは、人々の関心を引き、共感を呼び、リポスト（RT）や「いいね」を促進するような工夫が凝らされている必要があります。

# 考慮すべき「バズる」要素
ポストを作成する際には、以下の要素を多様に組み合わせてください。

1.  **感情への訴求:** 喜び、驚き、感動、共感、笑い、時には軽い怒りや問題提起など、強い感情を呼び起こす。
2.  **共感性:** 多くの人が「あるある！」と感じるような経験、悩み、願望に触れる。
3.  **意外性・発見:** 常識を覆す事実、知られざる情報、新しい視点を提供する。
4.  **有用性・学び:** すぐに役立つライフハック、知識、ヒント、アドバイスを提供する。
5.  **問いかけ・参加:** ユーザーに意見を求めたり、選択肢を提示したりして、リプライや引用リポストを促す。
6.  **ストーリーテリング:** 短い中に起承転結や感情の動きを感じさせる物語を盛り込む。
7.  **ユーモア・皮肉:** 面白い言い回し、自虐ネタ、世相を斬るようなウィットに富んだ表現を使う。
8.  **強い意見・主張:** （炎上リスクに注意しつつ）断定的な表現や、議論を呼ぶような視点を提示する。
9.  **視覚的訴求力（テキストで表現）:** 情景が目に浮かぶような描写や、インパクトのある言葉を選ぶ。
10. **簡潔さとインパクト:** Xのフォーマットに合わせ、短くても記憶に残るフレーズや構成を意識する。
11. **ギャップ:** 期待と現実の差、理想と現実のギャップなどを提示する。
12. **トレンド・時事性:** （可能であれば）キーワードと関連する現在のトレンドや話題を絡める。

# 出力形式

*   48個のポスト案を生成してください。
*   各ポスト案は、独立したテキストとして提示してください。
*   多様な角度（例：質問形式、断言形式、共感形式、ライフハック形式、ユーモア形式、皮肉形式、感動形式、問題提起形式など）からアイデアを出してください。
*   必要に応じて、絵文字を効果的に使用してください。
*   ハッシュタグは、ポストの内容に合わせて**最大2つ**まで、自然な形で含めても構いませんが、必須ではありません。
*   リスト形式や箇条書き形式のポスト案もいくつか含めてください。
*   各ポスト案は、Xの文字数制限（現在は日本語で140文字）を意識し、比較的短く、読みやすい長さにしてください。
*   生成するJSONは、以下の形式に従ってください。

   {
    "posts": [
       { "text": "ここに1つ目のポスト案のテキストが入ります。絵文字や #ハッシュタグ もOKです。🎉" },
       { "text": "ここに2つ目のポスト案のテキストが入ります。" },
       // ... (合計48個のオブジェクト)
       { "text": "ここに48個目のポスト案のテキストが入ります。" }
     ]
   }
*   上記以外のテキスト（例: 「はい、生成しました。」などの前置きや後書き）はJSONに含めないでください。JSON文字列のみを出力してください。

# 注意事項
*   生成するのはあくまで「ポスト案」であり、実際の投稿時にはユーザーが内容を吟味・修正する必要があります。
*   「バズる」ことを保証するものではありませんが、その可能性を高めることを目指します。
*   特定の個人や団体を不当に攻撃したり、差別を助長したりする内容は避けてください。
*   キーワードによっては、上記の要素をすべて満たすのが難しい場合もありますが、可能な限り多様なアプローチを試みてください。`;

const userPromptX = `繰り返します。JSONデータ以外を返さないでください。以下のキーワードを使って、バズる可能性のあるX（旧Twitter）のポスト案を48個作成してください。多様な角度や感情に訴えかけるような、面白くて共感を呼ぶアイデアをお願いします。キーワード:`;

async function callGeminiApi(apiKey: string, keyword: string): Promise<string> {
  const normalizedApiKey = normalizeGeminiApiKey(apiKey);
  if (!normalizedApiKey) {
    throw new Error('APIキーが設定されていません。');
  }
  const validationError = validateGeminiApiKey(normalizedApiKey);
  if (validationError) {
    throw new Error(validationError);
  }
  const genAI = new GoogleGenAI({ apiKey: normalizedApiKey });
  const systemInstruction = systemPromptX;
  const userPrompt = `${userPromptX} ${keyword}`;
  const response = await genAI.models.generateContent({
    model: 'gemini-flash-lite-latest',
    contents: userPrompt,
    config: {
      systemInstruction,
    },
  });
  console.log('APIレスポンス:', response);
  const blockReason = response.promptFeedback?.blockReason;
  if (blockReason) {
    throw new Error(`コンテンツ生成がブロックされました: ${blockReason}`);
  }
  return response.text ?? '';
}
// --- 実際のAPI呼び出し ここまで ---

// // --- シミュレーション用のAPI呼び出し ---
// async function callGeminiApiSimulator(keyword: string): Promise<string> {
//   console.log(`API呼び出しシミュレーション (JSON): ${keyword}`);
//   await new Promise((resolve) => setTimeout(resolve, 1000 + Math.random() * 1500));

//   if (keyword.toLowerCase() === 'エラーテスト') {
//     // API自体がエラーを返す場合
//     throw new Error('サーバー側でシミュレートされたエラー。');
//   }
//   if (keyword.toLowerCase() === '不正jsonテスト') {
//     // 不正なJSONを返す場合
//     return `{"posts": [{"text": "ポスト1"}, {"text": "ポスト2"}}`; // JSONが途中で切れている
//   }
//   if (keyword.toLowerCase() === '空テスト') {
//     // 空の配列を持つJSONを返す場合
//     return JSON.stringify({ posts: [] });
//   }
//   if (keyword.toLowerCase() === '短すぎテスト') {
//     // 少ない要素数のJSONを返す場合
//     return JSON.stringify({ posts: [{ text: '短いレスポンス1' }, { text: '短いレスポンス2' }] });
//   }

//   const postsArray = Array.from({ length: 48 }, (_, i) => ({
//     text: `${keyword}に関する${i + 1}番目のJSON形式アイデア💡\n#${keyword}`,
//   }));

//   return JSON.stringify({ posts: postsArray }); // JSON文字列を返す
// }
// // --- シミュレーションここまで ---

// 各 { 位置から、文字列リテラル/エスケープを考慮して対応する } までのバランスの取れた部分
// 文字列を抽出する。greedy な /\{[\s\S]*}/ と違い、文中の余計な波括弧（例:「{keyword}」や
// 末尾の余分な }）やテキスト値内の波括弧を巻き込まず、本物の JSON オブジェクト候補を左から
// 順に列挙できる。外側のオブジェクトでラップされた JSON でも、内側の { "posts": ... }
// 候補まで試せるようにする。
const balancedObjectCandidates = function* (s: string): IterableIterator<string> {
  let start = s.indexOf('{');
  while (start >= 0) {
    let depth = 0;
    let inStr = false;
    let esc = false;
    let matchEnd = -1;
    for (let i = start; i < s.length; i++) {
      const ch = s[i];
      if (inStr) {
        if (esc) {esc = false;}
        else if (ch === '\\') {esc = true;}
        else if (ch === '"') {inStr = false;}
      } else if (ch === '"') {inStr = true;}
      else if (ch === '{') {depth++;}
      else if (ch === '}') {
        depth--;
        if (depth === 0) {
          matchEnd = i;
          break;
        }
      }
    }
    if (matchEnd >= 0) {
      yield s.slice(start, matchEnd + 1);
      start = s.indexOf('{', start + 1);
    } else {
      start = s.indexOf('{', start + 1);
    }
  }
};

// APIレスポンス(JSON)をパースしてPostData[]に変換する関数。
// lightモデルは指示しても ```json フェンスや前後の会話文（余計な波括弧を含むことも）を混ぜる
// ことがある。クリーンな順に候補を試す: (1) ```json フェンスの中身 → (2) 文字列全体 →
// (3) 左から順のバランス括弧オブジェクト。各候補に JSON.parse＋形ガードを適用し、最初に
// 成立したものを採用する。これにより前後の会話文・迷子の波括弧・テキスト値内の波括弧の
// いずれにも耐性を持たせる。
const parseAndTransformApiResponse = (rawJsonString: string): PostData[] => {
  const cleaned = rawJsonString.trim();

  // 1候補をパース＋形ガードし、成立すれば PostData[] を返す（失敗時 null）。
  const tryParse = (str: string): PostData[] | null => {
    let parsedData: unknown;
    try {
      parsedData = JSON.parse(str);
    } catch {
      return null;
    }
    if (
      typeof parsedData === 'object' &&
      parsedData !== null &&
      'posts' in parsedData &&
      Array.isArray(parsedData.posts) &&
      parsedData.posts.every(
        (item: any) => typeof item === 'object' && item !== null && typeof item.text === 'string'
      )
    ) {
      const apiResponse = parsedData as GeminiApiResponse;
      const now = Date.now();
      return apiResponse.posts.map(
        (post, index): PostData => ({
          id: `${now}-${index}`, // ユニークID生成
          text: post.text,
          adopted: false,
        })
      );
    }
    return null;
  };

  // クリーンな順に試し、成功した時点で返す（後段の重い処理を走らせない）。
  // 1. ```json フェンスがあればその中身。無ければ文字列全体（フェンスがあると全体は ``` を
  //    含み JSON.parse が必ず失敗するため試さない）。
  const fence = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) {
    const res = tryParse(fence[1].trim());
    if (res) {
      return res;
    }
  } else {
    const whole = tryParse(cleaned);
    if (whole) {
      return whole;
    }
  }
  // 2. 左から順のバランス括弧オブジェクト。成立したブロックの内側は再走査しない。
  for (const candidate of balancedObjectCandidates(cleaned)) {
    const res = tryParse(candidate);
    if (res) {
      return res;
    }
  }
  // どの候補も期待したJSON構造にならなかった
  console.error('APIレスポンスが期待されたJSON構造ではありません:', rawJsonString);
  throw new Error('APIレスポンスの解析に失敗しました。APIレスポンスの形式が不正です。');
};

// API呼び出しとパースを行うメイン関数 (外部からこれを呼ぶ)
export const fetchGeneratedPostsAPI = async (
  apiKey: string,
  keyword: string
): Promise<PostData[]> => {
  try {
    // ↓↓↓ 実際のAPI呼び出し (JSON文字列が返ってくる想定) ↓↓↓
    const jsonString = await callGeminiApi(apiKey, keyword);
    // ↓↓↓ シミュレーション (JSON文字列が返ってくる) ↓↓↓
    //const jsonString = await callGeminiApiSimulator(keyword);

    if (!jsonString || jsonString.trim() === '') {
      console.log(`キーワード "${keyword}" でAPIから空のレスポンスが返されました。`);
      return []; // 空のレスポンスは空配列として扱う
    }

    const posts = parseAndTransformApiResponse(jsonString);

    if (posts.length === 0) {
      console.log(`キーワード "${keyword}" で有効なポスト案が見つかりませんでした (パース後)。`);
    } else if (posts.length < 48 && keyword.toLowerCase() !== '短すぎテスト') {
      console.warn(`期待した48件ではなく、${posts.length}件のポストが生成されました。`);
    }

    return posts;
  } catch (error) {
    console.error('API処理中にエラーが発生しました:', error);
    // エラーを再スローして、createAsyncThunkのrejectedに渡す
    throw error instanceof Error ? error : new Error('不明なAPIエラーが発生しました。');
  }
};
