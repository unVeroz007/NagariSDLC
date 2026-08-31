# Kode Mermaid Diagram Laporan KP NagariSDLC

Salin satu blok kode ke [Mermaid Live Editor](https://mermaid.live), lalu ekspor sebagai SVG atau PNG. Untuk laporan Word, gunakan latar putih, font yang mudah dibaca, dan resolusi tinggi. Kode ini hanya memodelkan NagariSDLC; bagan organisasi D-02 tetap harus disesuaikan dengan struktur resmi instansi.

## D-01 - Alur end-to-end NagariSDLC

```mermaid
flowchart TD
    A[Business User mengajukan kebutuhan] --> B[Lead Group melakukan review]
    B -->|Ditolak| X[REJECTED]
    B -->|Disetujui| C[Analyst melakukan analisis]
    C --> D[Development Lead melakukan disposisi]
    D --> E[PM atau Analyst Pengembangan mengelola proyek]
    E --> F[Developer mengerjakan task]
    F --> G{Semua task aktif selesai?}
    G -->|Belum| F
    G -->|Ya| H[SIT tiga tahap]
    H -->|Revisi| F
    H -->|Lulus| I[UAT internal tiga tahap]
    I -->|Minor| J[Perbaikan tanpa rollback]
    J --> I
    I -->|Mayor| K[UAT_REVISION_DEV]
    K --> F
    I -->|Diterima dan approval lengkap| L[DEV_COMPLETED]
    L --> M1[Jalur QA]
    L --> M2[Jalur Keamanan Siber]
    M1 --> N{QA dan Siber PASSED?}
    M2 --> N
    N -->|Belum| O[Tunggu atau selesaikan pengembalian]
    O --> M1
    O --> M2
    N -->|Ya| P[PM mengajukan migrasi dan rilis]
    P --> Q[Quality Gate Head of IT]
    Q -->|Setuju| R[LIVE_PRODUCTION]
    Q -->|Tolak| X
```

## D-01A - Proses sebelum sistem terpusat

```mermaid
flowchart LR
    U[Unit Peminta] --> D1[Dokumen kebutuhan]
    D1 --> C1[Konfirmasi manual]
    C1 --> DEV[Tim Pengembangan]
    DEV --> D2[Catatan task terpisah]
    DEV --> SIT[Dokumen SIT]
    SIT --> UAT[Dokumen UAT]
    UAT --> QA[Catatan QA]
    UAT --> CY[Catatan Siber]
    QA --> C2[Konfirmasi status]
    CY --> C2
    C2 --> REL[Keputusan rilis]
    D1 -. Risiko duplikasi .-> R1[Informasi tidak sinkron]
    D2 -. Risiko keterlacakan .-> R2[Status dan bukti sulit ditelusuri]
    C1 -. Risiko keterlambatan .-> R3[Approval membutuhkan konfirmasi berulang]
```

## D-02 - Struktur unit representatif

> Ganti nama unit dan jabatan dengan struktur resmi Bank Nagari sebelum dimasukkan ke laporan.

```mermaid
flowchart TD
    HIT[Head of IT]
    HIT --> PLAN[Grup Perencanaan dan QA]
    HIT --> DEV[Grup Pengembangan]
    HIT --> CYBER[Grup Keamanan Siber]
    HIT --> INFRA[Grup Infrastruktur]
    PLAN --> LG[Lead Group]
    PLAN --> AN[Analyst]
    PLAN --> QAL[QA Lead]
    PLAN --> QAT[QA Tester]
    DEV --> DL[Development Lead]
    DEV --> PM[Project Manager atau Analyst Pengembangan]
    DEV --> D[Developer]
    D --> M[Mahasiswa KP - Fullstack Developer]
    CYBER --> CL[Cyber Lead]
    CYBER --> PT[Pentester]
```

## D-03 - Arsitektur sistem

```mermaid
flowchart LR
    subgraph CLIENT[Klien - React 19 SPA]
        UI[Halaman dan Komponen]
        CTX[Context dan Router]
        APIJS[services/api.js]
        META[localStorage: profil dan metadata sesi]
    end

    subgraph SERVER[Server - Laravel 13 dan PHP 8.3]
        ROUTE[Routes dan Middleware]
        REQ[Form Request]
        CTRL[Controller dan Resource]
        SVC[Business Services]
        MODEL[Eloquent Models]
        EVENT[Event dan Notification]
    end

    subgraph DATA[Data dan Berkas]
        MYSQL[(MySQL)]
        VAULT[(Document Vault)]
        LOG[(Activity dan Status History)]
    end

    UI --> CTX --> APIJS
    APIJS -->|REST JSON, credentials include, X-Requested-With| ROUTE
    COOKIE[Cookie HttpOnly - token Sanctum] --> ROUTE
    BEARER[Authorization Bearer - kompatibilitas] --> ROUTE
    ROUTE --> REQ --> CTRL --> SVC --> MODEL --> MYSQL
    SVC --> EVENT
    MODEL --> VAULT
    SVC --> LOG
    EVENT -. BROADCAST_CONNECTION log pada snapshot .-> REALTIME[Reverb jika diaktifkan]
```

## D-04 - Use case aktor utama

```mermaid
flowchart LR
    BU[Business User] --> UC1((Ajukan proyek))
    BU --> UC2((Pantau status))
    BU --> UC7((UAT dan approval peminta))

    LG[Lead Group] --> UC3((Review kebutuhan))
    AN[Analyst] --> UC4((Analisis kebutuhan))
    DL[Development Lead] --> UC5((Disposisi pengembangan))
    PM[Project Manager] --> UC6((Kelola tim dan task))
    PM --> UC7
    PM --> UC10((Ajukan QA, Siber, dan rilis))
    DEV[Developer] --> UC6
    DEV --> UC8((Eksekusi dan approval SIT))

    QAL[QA Lead] --> UC9((Disposisi dan sign-off QA))
    QAT[QA Tester] --> UC9
    CL[Cyber Lead] --> UC11((Disposisi dan sign-off Siber))
    PT[Pentester] --> UC11
    HIT[Head of IT] --> UC12((Putuskan Quality Gate))
    SA[Super Admin] --> UC13((Kelola master dan audit))
```

## D-05 - State machine proyek

```mermaid
stateDiagram-v2
    [*] --> PENDING
    PENDING --> IN_REVIEW
    PENDING --> REJECTED
    PENDING --> CANCELLED
    IN_REVIEW --> ANALYSIS_APPROVED
    IN_REVIEW --> PENDING
    IN_REVIEW --> REJECTED
    ANALYSIS_APPROVED --> READY_FOR_DEVELOPMENT
    ANALYSIS_APPROVED --> IN_REVIEW
    READY_FOR_DEVELOPMENT --> DEV_ANALYSIS
    READY_FOR_DEVELOPMENT --> IN_DEVELOPMENT
    DEV_ANALYSIS --> DEV_ANALYSIS_DONE
    DEV_ANALYSIS_DONE --> IN_DEVELOPMENT
    IN_DEVELOPMENT --> SIT_IN_PROGRESS
    IN_DEVELOPMENT --> DEV_COMPLETED
    IN_DEVELOPMENT --> ON_HOLD
    SIT_IN_PROGRESS --> SIT_PASSED
    SIT_IN_PROGRESS --> SIT_REVISION
    SIT_REVISION --> IN_DEVELOPMENT
    SIT_REVISION --> SIT_IN_PROGRESS
    SIT_PASSED --> UAT_IN_PROGRESS
    SIT_PASSED --> DEV_COMPLETED
    UAT_IN_PROGRESS --> UAT_PASSED
    UAT_IN_PROGRESS --> DEV_COMPLETED
    UAT_IN_PROGRESS --> UAT_REVISION_DEV
    UAT_IN_PROGRESS --> UAT_REVISION_SIT
    UAT_REVISION_DEV --> IN_DEVELOPMENT
    UAT_REVISION_DEV --> SIT_IN_PROGRESS
    UAT_REVISION_SIT --> SIT_IN_PROGRESS
    UAT_PASSED --> DEV_COMPLETED
    DEV_COMPLETED --> READY_FOR_QA
    DEV_COMPLETED --> QA_IN_PROGRESS
    DEV_COMPLETED --> CYBER_IN_PROGRESS
    READY_FOR_QA --> QA_IN_PROGRESS
    READY_FOR_QA --> CYBER_IN_PROGRESS
    QA_IN_PROGRESS --> QA_PASSED
    QA_IN_PROGRESS --> RETURN_TO_DEV
    CYBER_IN_PROGRESS --> CYBER_PASSED
    CYBER_IN_PROGRESS --> RETURN_TO_DEV
    RETURN_TO_DEV --> IN_DEVELOPMENT
    RETURN_TO_DEV --> READY_FOR_QA
    QA_PASSED --> PENDING_GOLIVE: cyber_status PASSED
    CYBER_PASSED --> PENDING_GOLIVE: qa_status PASSED
    PENDING_GOLIVE --> LIVE_PRODUCTION
    PENDING_GOLIVE --> REJECTED
    ON_HOLD --> IN_DEVELOPMENT
    ON_HOLD --> PENDING
    REJECTED --> PENDING
    REJECTED --> IN_REVIEW
    LIVE_PRODUCTION --> [*]
    CANCELLED --> [*]

    note right of READY_FOR_UAT
      Legacy: tidak memiliki
      transisi masuk atau keluar
    end note
```

## D-06 - Alur SIT

```mermaid
flowchart TD
    A{Semua task aktif selesai?} -->|Tidak| B[Developer menyelesaikan task]
    B --> A
    A -->|Ya| C[Tahap 1 - URL staging dan skenario]
    C --> D[Tahap 2 - Eksekusi per task]
    D --> E{Simpan draft atau final?}
    E -->|Draft| D
    E -->|Final| F{Semua task OK dan bukti lengkap?}
    F -->|Tidak| D
    F -->|Ada revisi| G[Task kembali in_progress]
    G --> B
    F -->|Ya| H[Tahap 3 - Review dan dokumen hasil SIT]
    H --> I[Approval seluruh developer]
    H --> J[Approval PM]
    H --> K[Approval Development Lead]
    I --> L{Semua approval dan dokumen lengkap?}
    J --> L
    K --> L
    L -->|Tidak| H
    L -->|Ya| M[SIT_PASSED]
    M --> N[UAT_IN_PROGRESS]
```

## D-07 - Alur UAT

```mermaid
flowchart TD
    A[SIT_PASSED] --> B[Tahap 1 - Skenario, peserta, tanggal, undangan]
    B --> C[Tahap 2 - Eksekusi tiap skenario]
    C --> D{Simpan draft atau final?}
    D -->|Draft| C
    D -->|Final| E{Kesimpulan}
    E -->|Accepted| F[Tahap 3 - Putaran approval]
    E -->|Minor revision| G[Buat Change Request minor]
    G --> H[Task diperbaiki tanpa rollback]
    H --> I{Semua CR minor resolved?}
    I -->|Belum| H
    I -->|Ya| F
    E -->|Major revision| J[Arsipkan putaran UAT dan SIT]
    J --> K[UAT_REVISION_DEV]
    K --> L[Developer menyelesaikan task mayor]
    L --> M[SIT ulang menyeluruh]
    M -->|Lulus| B
    F --> N[Approval individual pihak peminta dan IT]
    N --> O{Semua approval sah?}
    O -->|Belum| N
    O -->|Ya| P[DEV_COMPLETED]
```

## D-08 - Jalur QA dan keamanan siber

```mermaid
flowchart TD
    A[DEV_COMPLETED] --> QA1[QA - Pengajuan]
    A --> CY1[Siber - Pengajuan]

    QA1 --> QA2[QA Lead - Disposisi]
    QA2 --> QA3[QA Tester - Laporan]
    QA3 --> QA4[QA Lead - Sign-off]
    QA4 -->|Pass| QAP[qa_status PASSED]
    QA4 -->|Fail| QR[Return Round QA]

    CY1 --> CY2[Cyber Lead - Disposisi]
    CY2 --> CY3[Pentester - Laporan]
    CY3 --> CY4[Cyber Lead - Sign-off]
    CY4 -->|Pass| CYP[cyber_status PASSED]
    CY4 -->|Fail| CR[Return Round Siber]

    QR --> DEV[RETURN_TO_DEV dan task perbaikan]
    CR --> DEV
    DEV --> RESUB[Pengajuan ulang hanya setelah gate task terpenuhi]
    RESUB --> QA1
    RESUB --> CY1

    QAP --> GATE{QA dan Siber PASSED?}
    CYP --> GATE
    GATE -->|Ya| REL[PENDING_GOLIVE]
```

## D-09 - Relasi approver UAT

```mermaid
flowchart LR
    P[UAT Approval Round]
    P --> R1[Requester]
    P --> R2[Requester Group Lead]
    P --> R3[Requester Division Lead]
    P --> R4[Developer - minimal satu]
    P --> R5[Analyst atau PM]
    P --> R6[Development Group Lead]
    P --> R7[Technology Division Lead]

    R1 --> EX[External Link dan verifikasi nomor HP]
    R2 --> EX
    R3 --> EX
    R4 --> IN[Internal Account]
    R5 --> IN
    R6 --> IN
    R7 --> IN

    EX --> DEC[Keputusan individual]
    IN --> DEC
    DEC -->|Semua lengkap| DONE[Round completed]
    DEC -->|Revisi baru| SUPER[Round superseded]
    SUPER --> KEEP[Approved tetap disimpan; pending menjadi revoked]
```

## D-10 - Putaran pengembalian pengujian

```mermaid
flowchart TD
    A[Lead sign-off FAIL] --> B[Track status menjadi FAILED]
    B --> C[Project status RETURN_TO_DEV]
    C --> D[ProjectReturnRoundService membuka OPEN round]
    D --> E[PM membuat task dengan return_round_id]
    E --> F{Ada task perbaikan?}
    F -->|Tidak| X[Pengajuan ulang ditolak]
    F -->|Ya| G{Semua task punya assignee?}
    G -->|Tidak| X
    G -->|Ya| H{Semua task done atau take_down?}
    H -->|Tidak| X
    H -->|Ya| I[PM mengajukan ulang lewat endpoint submit yang sama]
    I --> J[Round menjadi RESUBMITTED]
    J --> K[Track status SUBMITTED]
    K --> L[Disposisi, laporan, dan sign-off baru]
```

## D-11 - ERD NagariSDLC

```mermaid
erDiagram
    GROUPS ||--o{ ROLES : contains
    ROLES ||--o{ USERS : assigned_to
    DIVISIONS ||--o{ USERS : has
    DIVISIONS ||--o{ PROJECTS : owns
    USERS ||--o{ PROJECTS : creates
    USERS ||--o{ PROJECTS : manages
    USERS ||--o{ PROJECTS : analyzes
    PROJECTS ||--o{ PROJECT_TASKS : contains
    PROJECTS ||--o{ PROJECT_TEAM_MEMBERS : has
    USERS ||--o{ PROJECT_TEAM_MEMBERS : joins
    PROJECTS ||--o{ PROJECT_STATUS_HISTORIES : records
    USERS ||--o{ PROJECT_STATUS_HISTORIES : changes
    PROJECTS ||--o{ DOCUMENT_VAULTS : stores
    USERS ||--o{ DOCUMENT_VAULTS : uploads
    PROJECTS ||--o{ CHAT_MESSAGES : has
    USERS ||--o{ CHAT_MESSAGES : sends
    PROJECTS ||--o{ TEST_REPORTS : receives
    USERS ||--o{ TEST_REPORTS : tests
    PROJECTS ||--o{ UAT_APPROVAL_ROUNDS : opens
    UAT_APPROVAL_ROUNDS ||--o{ UAT_APPROVERS : contains
    USERS o|--o{ UAT_APPROVERS : linked_account
    PROJECTS ||--o{ RELEASE_REQUESTS : has
    PROJECTS ||--o{ PROJECT_RETURN_ROUNDS : returns
    TEST_REPORTS o|--o| PROJECT_RETURN_ROUNDS : triggers
    PROJECT_RETURN_ROUNDS ||--o{ PROJECT_TASKS : fix_tasks
    USERS ||--o{ NOTIFICATIONS : receives

    USERS {
        bigint id PK
        bigint role_id FK
        bigint division_id FK
        string name
        string email
        boolean is_active
    }
    PROJECTS {
        bigint id PK
        string req_id
        bigint created_by FK
        bigint pm_id FK
        bigint analyst_id FK
        string status
        string qa_status
        string cyber_status
        json sit_uat_data
    }
    PROJECT_TASKS {
        bigint id PK
        bigint project_id FK
        bigint assignee_id FK
        bigint return_round_id FK
        string status
        string priority
    }
    TEST_REPORTS {
        bigint id PK
        bigint project_id FK
        string test_type
        string result
        text tested_scenarios
        string reviewed_result
    }
    UAT_APPROVAL_ROUNDS {
        bigint id PK
        bigint project_id FK
        int round_number
        string status
    }
    UAT_APPROVERS {
        bigint id PK
        bigint uat_approval_round_id FK
        bigint user_id FK
        string approval_role
        string approval_mode
        string decision_status
    }
    PROJECT_RETURN_ROUNDS {
        bigint id PK
        bigint project_id FK
        bigint test_report_id FK
        string track
        int round_number
        string status
    }
```

## D-12 - Class relationship inti

```mermaid
classDiagram
    class ProjectController
    class TaskController
    class QARequestController
    class CyberRequestController
    class ReleaseRequestController
    class ProjectWorkflowService
    class TestingTrackService
    class UatExecutionService
    class UatApprovalService
    class ProjectReturnRoundService
    class ProjectAccessService
    class Project
    class ProjectTask
    class TestReport
    class UatApprovalRound
    class UatApprover
    class ProjectReturnRound

    ProjectController --> ProjectWorkflowService
    ProjectController --> UatExecutionService
    ProjectController --> UatApprovalService
    ProjectController --> ProjectAccessService
    TaskController --> ProjectReturnRoundService
    QARequestController --> TestingTrackService
    CyberRequestController --> TestingTrackService
    ReleaseRequestController --> ProjectWorkflowService
    TestingTrackService --> ProjectWorkflowService
    TestingTrackService --> ProjectReturnRoundService
    UatExecutionService --> UatApprovalService
    ProjectWorkflowService --> Project
    Project "1" --> "many" ProjectTask
    Project "1" --> "many" TestReport
    Project "1" --> "many" UatApprovalRound
    UatApprovalRound "1" --> "many" UatApprover
    Project "1" --> "many" ProjectReturnRound
    ProjectReturnRound "1" --> "many" ProjectTask
```

## D-13 - Sequence login

```mermaid
sequenceDiagram
    actor User
    participant UI as React Login
    participant API as Laravel Auth API
    participant DB as MySQL
    participant Browser as Browser Cookie Store

    User->>UI: Masukkan email dan password
    UI->>API: POST /api/v1/auth/login
    API->>DB: Validasi user aktif dan password
    DB-->>API: User valid
    API->>API: Buat token Sanctum
    API-->>Browser: Set-Cookie HttpOnly nagari_sdlc_token
    API-->>UI: User dan metadata sesi
    UI->>UI: Simpan profil dan metadata, tanpa token
    UI-->>User: Tampilkan dashboard
    User->>UI: Buka data proyek
    UI->>API: GET /projects + credentials include + X-Requested-With
    Browser-->>API: Cookie HttpOnly
    API->>API: Middleware menerjemahkan cookie ke Bearer internal
    API-->>UI: Data proyek sesuai scope
```

## D-14 - Sequence persetujuan UAT eksternal

```mermaid
sequenceDiagram
    participant PM as Project Manager
    participant API as UAT Approval API
    participant DB as Approval Tables
    actor Approver as Approver Eksternal

    PM->>API: POST buat atau rotasi link approver
    API->>DB: Simpan hash link token
    API-->>PM: URL pribadi
    PM-->>Approver: Kirim URL melalui kanal resmi
    Approver->>API: GET /uat-approvals/{token}
    API-->>Approver: Preview dan nomor HP termasking
    Approver->>API: POST verify dengan nomor HP
    API->>DB: Cocokkan keyed hash nomor HP
    DB-->>API: Cocok
    API->>DB: Simpan hash access token dan expiry
    API-->>Approver: Access token sementara
    Approver->>API: GET detail dengan X-UAT-Approval-Access
    API-->>Approver: Hasil UAT dan dokumen yang diizinkan
    Approver->>API: POST decision approved atau rejected
    API->>DB: Simpan keputusan individual dan waktu
    API-->>Approver: Konfirmasi keputusan
```

## D-15 - Peta navigasi halaman

```mermaid
flowchart TD
    LOGIN[Login] --> DASH[Dashboard sesuai role]
    DASH --> PROJ[Proyek]
    PROJ --> LIST[Daftar Proyek]
    PROJ --> DETAIL[Detail Proyek]
    DETAIL --> TIME[Timeline]
    DETAIL --> DOC[Document Vault]
    DETAIL --> CHAT[Chat]
    DETAIL --> TASK[Task dan Kanban]
    DETAIL --> SIT[SIT]
    DETAIL --> UAT[UAT]

    DASH --> WORK[Workspace Peran]
    WORK --> PLAN[Perencanaan]
    WORK --> DEV[Pengembangan]
    WORK --> QA[Tugas QA]
    WORK --> CY[Tugas Siber]
    WORK --> APPROVAL[Inbox Approval UAT]
    WORK --> RELEASE[Release Request]
    WORK --> GATE[Quality Gate]

    DASH --> NOTIF[Notifikasi]
    DASH --> ACT[Activity Log]
    DASH --> ADMIN[Administrasi - Super Admin]
    ADMIN --> USERS[Pengguna]
    ADMIN --> DIV[Divisi]
    ADMIN --> GROUPS[Grup]
    ADMIN --> ROLES[Role dan Menu Access]
```
