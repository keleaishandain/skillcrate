use std::collections::{HashMap, HashSet};

const STOP: &[&str] = &[
    "the", "and", "for", "with", "use", "when", "this", "that", "you", "are", "from", "not",
    "your", "can", "will", "all", "into", "them", "also", "its", "has", "have", "been", "was",
    "were", "should", "would", "skill", "skills", "using", "used", "user", "asks", "any", "such",
    "including", "these", "there", "which", "what", "how", "trigger", "triggers",
];

/// 中英混合分词：英文按词（≥2 字符、去停用词），中文按单字 + 相邻双字。
pub fn tokenize(text: &str) -> Vec<String> {
    let lower = text.to_lowercase();
    let mut tokens = Vec::new();
    let mut word = String::new();
    let mut cjk_prev: Option<char> = None;
    let flush = |word: &mut String, tokens: &mut Vec<String>| {
        if word.len() >= 2
            && !STOP.contains(&word.as_str())
            && !word.chars().all(|c| c.is_ascii_digit())
        {
            tokens.push(word.clone());
        }
        word.clear();
    };
    for ch in lower.chars() {
        let is_cjk = ('\u{4e00}'..='\u{9fff}').contains(&ch);
        if ch.is_ascii_alphanumeric() {
            word.push(ch);
            cjk_prev = None;
        } else {
            flush(&mut word, &mut tokens);
            if is_cjk {
                tokens.push(ch.to_string());
                if let Some(prev) = cjk_prev {
                    tokens.push(format!("{prev}{ch}"));
                }
                cjk_prev = Some(ch);
            } else {
                cjk_prev = None;
            }
        }
    }
    flush(&mut word, &mut tokens);
    tokens
}

fn uf_find(parent: &mut Vec<usize>, i: usize) -> usize {
    let pi = parent[i];
    if pi != i {
        let root = uf_find(parent, pi);
        parent[i] = root;
        root
    } else {
        i
    }
}

pub struct Clusters {
    /// 每组是成员下标列表（≥2 才成组）
    pub groups: Vec<Vec<usize>>,
    /// 与 groups 一一对应的共同关键词
    pub keywords: Vec<Vec<String>>,
}

/// E4：V1 用本地 TF-IDF 余弦相似度近似语义分组（零 API 依赖、开箱即用）；
/// D4 的 0.8 阈值针对 embedding 余弦，词法尺度不同，默认 0.35，可调参。
/// embedding + LLM 复核为 V1.1 升级路径。
pub fn cluster(texts: &[String], threshold: f64) -> Clusters {
    let n = texts.len();
    let toks: Vec<Vec<String>> = texts.iter().map(|t| tokenize(t)).collect();
    let mut df: HashMap<&str, usize> = HashMap::new();
    for t in &toks {
        let uniq: HashSet<&str> = t.iter().map(|s| s.as_str()).collect();
        for u in uniq {
            *df.entry(u).or_default() += 1;
        }
    }
    let idf = |tok: &str| -> f64 {
        let d = *df.get(tok).unwrap_or(&1) as f64;
        ((n as f64 + 1.0) / (d + 1.0)).ln() + 1.0
    };
    let vecs: Vec<HashMap<&str, f64>> = toks
        .iter()
        .map(|t| {
            let mut tf: HashMap<&str, f64> = HashMap::new();
            for tok in t {
                *tf.entry(tok.as_str()).or_default() += 1.0;
            }
            let mut v: HashMap<&str, f64> =
                tf.into_iter().map(|(k, c)| (k, c * idf(k))).collect();
            let norm = v.values().map(|x| x * x).sum::<f64>().sqrt();
            if norm > 0.0 {
                for val in v.values_mut() {
                    *val /= norm;
                }
            }
            v
        })
        .collect();
    let mut parent: Vec<usize> = (0..n).collect();
    for i in 0..n {
        for j in (i + 1)..n {
            let (a, b) = (&vecs[i], &vecs[j]);
            let (small, large) = if a.len() < b.len() { (a, b) } else { (b, a) };
            let sim: f64 = small
                .iter()
                .filter_map(|(k, va)| large.get(k).map(|vb| va * vb))
                .sum();
            if sim >= threshold {
                let (ri, rj) = (uf_find(&mut parent, i), uf_find(&mut parent, j));
                if ri != rj {
                    parent[ri] = rj;
                }
            }
        }
    }
    let mut by_root: HashMap<usize, Vec<usize>> = HashMap::new();
    for i in 0..n {
        let r = uf_find(&mut parent, i);
        by_root.entry(r).or_default().push(i);
    }
    let mut groups: Vec<Vec<usize>> = by_root.into_values().filter(|g| g.len() >= 2).collect();
    groups.sort_by_key(|g| std::cmp::Reverse(g.len()));
    let keywords = groups
        .iter()
        .map(|g| {
            let mut score: HashMap<&str, f64> = HashMap::new();
            for &i in g {
                for (k, v) in &vecs[i] {
                    *score.entry(k).or_default() += v;
                }
            }
            let mut items: Vec<(&str, f64)> = score
                .into_iter()
                .filter(|(k, _)| k.chars().count() >= 2)
                .collect();
            items.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));
            items.into_iter().take(4).map(|(k, _)| k.to_string()).collect()
        })
        .collect();
    Clusters { groups, keywords }
}
