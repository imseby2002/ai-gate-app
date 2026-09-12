-- ============================================================================
-- Migration: 150_vietnam_legal_system.sql
-- Description: Vietnam Legal & Business Compliance AI System (Documents, Nodes, Relations, Procedures, Cross-Border Rules)
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. 法律公務文件主檔 (Legal Documents)
CREATE TABLE IF NOT EXISTS legal_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    country_code VARCHAR(10) NOT NULL DEFAULT 'VN', -- VN, TW, JP, US 等
    document_number VARCHAR(100) NOT NULL,           -- 文號：如 66/2025/QH15, 15/2018/NĐ-CP
    document_type VARCHAR(50) NOT NULL,             -- Luật, Bộ luật, Nghị định, Thông tư, Quyết định, Công văn
    title_vi TEXT NOT NULL,                         -- 越南文標題
    title_en TEXT,                                  -- 英文標題
    title_zh TEXT,                                  -- 中文標題
    issuing_authority VARCHAR(200) NOT NULL,        -- 發布機關：Quốc hội, Chính phủ, Bộ Tài chính...
    signer VARCHAR(100),                            -- 簽署人
    issue_date DATE NOT NULL,                       -- 發布日期
    effective_date DATE NOT NULL,                   -- 生效日期
    expiry_date DATE,                               -- 失效/廢止日期 (NULL 表示現行有效)
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',   -- ACTIVE, NOT_YET_EFFECTIVE, AMENDED, PARTIALLY_AMENDED, REPEALED, EXPIRED, DRAFT
    is_consolidated BOOLEAN DEFAULT FALSE,          -- 是否為官方彙編整合版 (Văn bản hợp nhất)
    consolidates_docs JSONB DEFAULT '[]'::jsonb,    -- 所彙整的母法或修訂法規文號
    source_tier INT NOT NULL DEFAULT 1,             -- 來源權威層級 (1~5)
    source_url TEXT NOT NULL,                       -- 官方來源網址
    official_pdf_url TEXT,                          -- 官方原始檔案下載/預覽網址
    content_hash VARCHAR(64),                       -- 內容 SHA256 (每日異動偵測)
    metadata JSONB DEFAULT '{}'::jsonb,             -- 領域標籤 (稅務, 食品, 投資, 勞動...)
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_doc_country_num UNIQUE (country_code, document_number)
);

CREATE INDEX IF NOT EXISTS idx_legal_docs_dates ON legal_documents (effective_date, expiry_date, status);
CREATE INDEX IF NOT EXISTS idx_legal_docs_num ON legal_documents (document_number);

-- 2. 法律階層條款節點表 (Article / Clause / Point Nodes)
CREATE TABLE IF NOT EXISTS legal_nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES legal_documents(id) ON DELETE CASCADE,
    country_code VARCHAR(10) NOT NULL DEFAULT 'VN',
    node_type VARCHAR(20) NOT NULL,                 -- CHAPTER, SECTION, ARTICLE, CLAUSE, POINT
    chapter_number VARCHAR(20),                     -- Chương (例: Chương II)
    chapter_title TEXT,
    section_number VARCHAR(20),                     -- Mục (例: Mục 1)
    section_title TEXT,
    article_number VARCHAR(20) NOT NULL,            -- Điều (例: Điều 5)
    article_title TEXT,                             -- 條標題 (例: Điều kiện bảo đảm an toàn thực phẩm...)
    clause_number VARCHAR(20),                      -- Khoản (例: Khoản 2)
    point_number VARCHAR(20),                       -- Điểm (例: Điểm a)
    node_locator VARCHAR(100) NOT NULL,             -- 絕對定位碼：如 "Điều 5, Khoản 2, Điểm a"
    original_text_vi TEXT NOT NULL,                 -- 越南文原始條文
    translated_text_zh TEXT,                        -- 中文翻譯
    translated_text_en TEXT,                        -- 英文翻譯
    keywords TEXT[],                                -- 核心關鍵字 (聲調與無聲調)
    effective_from DATE NOT NULL,                   -- 該條款自身生效日期
    effective_to DATE,                              -- 該條款自身失效日期
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',   -- ACTIVE, AMENDED, REPEALED, EXPIRED
    amended_by_doc_id UUID REFERENCES legal_documents(id),
    amended_by_node_id UUID REFERENCES legal_nodes(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_legal_nodes_locator ON legal_nodes (document_id, article_number, clause_number, point_number);
CREATE INDEX IF NOT EXISTS idx_legal_nodes_temporal ON legal_nodes (effective_from, effective_to, status);
CREATE INDEX IF NOT EXISTS idx_legal_nodes_type ON legal_nodes (node_type);

-- 3. 法律關係圖邊表 (Legal Graph Relationships)
CREATE TABLE IF NOT EXISTS legal_relations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_doc_id UUID NOT NULL REFERENCES legal_documents(id) ON DELETE CASCADE,
    source_node_id UUID REFERENCES legal_nodes(id) ON DELETE CASCADE,
    relation_type VARCHAR(30) NOT NULL,             -- AMENDS, REPEALS, REPLACES, IMPLEMENTS, GUIDES, REFERENCES
    target_doc_id UUID NOT NULL REFERENCES legal_documents(id) ON DELETE CASCADE,
    target_node_id UUID REFERENCES legal_nodes(id) ON DELETE CASCADE,
    effective_date DATE NOT NULL,
    description_vi TEXT,                            -- 修訂或授權說明
    description_zh TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_legal_relations_lookup ON legal_relations (source_doc_id, target_doc_id, relation_type);

-- 4. 行政審批項目資料庫 (Procedure Catalog)
CREATE TABLE IF NOT EXISTS procedure_catalog (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    country_code VARCHAR(10) NOT NULL DEFAULT 'VN',
    code VARCHAR(50) NOT NULL,                      -- 官方行政手續代碼 (dichvucong 代碼)
    name_vi TEXT NOT NULL,                          -- 手續越文名稱 (例: Cấp Giấy chứng nhận cơ sở đủ điều kiện ATTP)
    name_zh TEXT NOT NULL,                          -- 中文名稱 (例: 申請食品安全合格機構證書)
    name_en TEXT,
    category VARCHAR(100) NOT NULL,                 -- 分類 (設立公司, 食品安全, 消防, 稅務, 商標, 進出口)
    industry VARCHAR(100) NOT NULL,                 -- 餐飲門市, 製造業, 貿易, 醫藥...
    province VARCHAR(50) NOT NULL DEFAULT 'ALL',    -- ALL: 全國統一; 或特定省份 (Hà Nội, TP.HCM 等)
    competent_authority TEXT NOT NULL,              -- 權責審批機關 (例: Sở Kế hoạch và Đầu tư, Chi cục An toàn vệ sinh thực phẩm)
    governing_body TEXT NOT NULL,                   -- 所屬部會 (例: Bộ Y tế, Bộ Công Thương)
    submission_method VARCHAR(50) NOT NULL,         -- ONLINE, IN_PERSON, BOTH
    online_url TEXT,                                -- 官方線上申請網址 (dichvucong)
    processing_time_days INT NOT NULL,              -- 法定審查工作日 (例: 15 工作日)
    official_fee_vnd NUMERIC(15, 2) DEFAULT 0,      -- 官方規費 (VND)
    fee_notes TEXT,
    result_document TEXT NOT NULL,                  -- 核發成果 (Giấy chứng nhận / Giấy phép...)
    conditions TEXT,                                -- 申辦法定條件
    source_url TEXT NOT NULL,                       -- 官方來源依據
    last_verified_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_proc_code_province UNIQUE (code, province)
);

CREATE INDEX IF NOT EXISTS idx_proc_cat_industry ON procedure_catalog (category, industry, province);

-- 5. 行政審批步驟表 (Procedure Steps DAG)
CREATE TABLE IF NOT EXISTS procedure_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    procedure_id UUID NOT NULL REFERENCES procedure_catalog(id) ON DELETE CASCADE,
    step_number INT NOT NULL,                       -- 步驟順序 (1, 2, 3...)
    title_vi TEXT NOT NULL,
    title_zh TEXT NOT NULL,
    description TEXT NOT NULL,
    responsible_party VARCHAR(50) NOT NULL,         -- APPLICANT (申請人), AUTHORITY (受理機關)
    prerequisite_step_numbers INT[],                -- 前置依賴步驟順序號
    duration_days INT,                              -- 該單一步驟工作天數
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. 行政申請應備文件與官方表格 (Procedure Dossier & Forms)
CREATE TABLE IF NOT EXISTS procedure_dossier_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    procedure_id UUID NOT NULL REFERENCES procedure_catalog(id) ON DELETE CASCADE,
    item_order INT NOT NULL DEFAULT 1,
    document_name_vi TEXT NOT NULL,                 -- 文件越文名稱
    document_name_zh TEXT NOT NULL,                 -- 中文名稱
    is_mandatory BOOLEAN NOT NULL DEFAULT TRUE,     -- 是否為強制文件
    form_code VARCHAR(50),                          -- 官方表格代號 (例: Mẫu số 01, NĐ 15/2018)
    form_template_url TEXT,                         -- 官方表格下載 URL
    sample_fill_url TEXT,                           -- 填寫範本 URL
    notarization_required BOOLEAN DEFAULT FALSE,    -- 是否需公證 (Công chứng)
    consular_legalization BOOLEAN DEFAULT FALSE,    -- 是否需外國使館認證 (Hợp法 hóa lãnh sự)
    copies_count INT DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. 跨國商品與設備進口及門市設立合規庫 (Cross-Border Compliance Rules)
CREATE TABLE IF NOT EXISTS cross_border_compliance_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    origin_country VARCHAR(10) NOT NULL,            -- 原產國 (TW, JP, CN, US...)
    destination_country VARCHAR(10) NOT NULL,       -- 目的國 (VN, TW, JP...)
    category VARCHAR(50) NOT NULL,                  -- FOOD (食品原料/茶葉), EQUIPMENT (餐飲設備), STORE (設立門市)
    item_name_zh TEXT NOT NULL,                     -- 品項名稱
    hs_code VARCHAR(20),                            -- 進口海關 HS Code
    legal_basis_doc_id UUID REFERENCES legal_documents(id),
    regulatory_requirements TEXT NOT NULL,          -- 法定檢驗/准入條件 (如越南 Tự công bố, QCVN, CR 標章)
    tariff_rate_percentage NUMERIC(5, 2),           -- 關稅稅率
    vat_rate_percentage NUMERIC(5, 2),              -- 進口增值稅 (VAT)
    special_consumption_tax NUMERIC(5, 2),          -- 特別消費稅 (如含糖飲料稅)
    required_certificates TEXT[],                   -- 必要證書 (CO, CQ, CFS)
    official_source_url TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. 每日異動審計與變更日誌 (Legal Change Logs)
CREATE TABLE IF NOT EXISTS legal_change_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    log_date DATE NOT NULL DEFAULT CURRENT_DATE,
    document_number VARCHAR(100) NOT NULL,
    change_type VARCHAR(50) NOT NULL,               -- NEW_DOC, AMENDED, REPEALED, CONSOLIDATED, PROCEDURE_UPDATED
    summary_vi TEXT NOT NULL,
    summary_zh TEXT NOT NULL,
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_change_logs_date ON legal_change_logs (log_date);
