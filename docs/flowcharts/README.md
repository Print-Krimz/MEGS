# MEGS Recruitment Platform — Workflow Flowcharts

This directory contains separated, downloadable flowcharts for each of the three primary roles in the MEGS platform:

1. 👤 **[Applicant Flowchart](file:///c:/Users/cnico/OneDrive/Desktop/MEGS/docs/flowcharts/applicant_flowchart.svg)**
2. 🎯 **[Talent Acquisition (TA) Flowchart](file:///c:/Users/cnico/OneDrive/Desktop/MEGS/docs/flowcharts/ta_flowchart.svg)**
3. ⚙️ **[Administrator Flowchart](file:///c:/Users/cnico/OneDrive/Desktop/MEGS/docs/flowcharts/admin_flowchart.svg)**
4. 🌐 **[Integrated 3-Role Swimlane Flowchart](file:///c:/Users/cnico/OneDrive/Desktop/MEGS/docs/flowcharts/integrated_system_flowchart.svg)**
5. 💻 **[Interactive Web Hub &amp; Exporter](file:///c:/Users/cnico/OneDrive/Desktop/MEGS/docs/flowcharts/flowcharts_hub.html)** *(Open in browser to preview & export to SVG/PNG/PDF)*

---

## 1. 👤 Applicant User Journey

```mermaid
flowchart TD
    A([1. Sign Up / Login]) --> B[2. Complete Profile & Upload Resume]
    B --> C[3. Browse Open Jobs]
    C --> D[4. Submit Application\nStatus: SUBMITTED]
    D --> E[⚡ Automated AI Parsing\nStatus: PARSING ➔ REVIEW]
    E --> F{TA Screening}
    
    F -->|Not Selected| G[Talent Pool\nStatus: TALENT_POOL]
    F -->|Passed| H[5. Initial TA Screening\nStatus: INITIAL_SCREENING]
    
    H --> I[6. Client Interview\nStatus: FINAL_INTERVIEW]
    I --> J[7. Upload Compliance Docs\nStatus: COMPLIANCE]
    J --> K([8. Hired & Deployed\nStatus: HIRED ➔ DEPLOYED])

    classDef primary fill:#0284c7,stroke:#38bdf8,stroke-width:2px,color:#ffffff;
    classDef ai fill:#312e81,stroke:#818cf8,stroke-width:2px,color:#ffffff;
    classDef success fill:#064e3b,stroke:#34d399,stroke-width:2px,color:#ffffff;
    classDef alt fill:#1e293b,stroke:#64748b,stroke-width:1.5px,color:#cbd5e1;

    class A,B,C,D,H,I,J primary;
    class E ai;
    class F,G alt;
    class K success;
```

---

## 2. 🎯 Talent Acquisition (TA) Recruiter Workflow

```mermaid
flowchart TD
    TA1([1. Approved MRF Intake]) --> TA2[Publish Job Postings\nStatus: OPEN]
    TA2 --> TA3[Candidate Sourcing]
    
    subgraph Sourcing["Candidate Sourcing Channels"]
        TA3A[Inbound Applications\nStatus: REVIEW]
        TA3B[KNN Vector Talent Pool Search\nSemantic Match]
    end
    
    TA3 --> TA3A
    TA3 --> TA3B
    TA3A --> TA4[2. Inspect AI Match Breakdown\nSkills, Exp, Distance & Semantic Fit]
    TA3B --> TA4
    
    TA4 --> TA5{Screening Decision}
    TA5 -->|Below Threshold| TA6[Tag to Talent Pool\nStatus: TALENT_POOL]
    TA5 -->|Shortlisted| TA7[3. Initial Screening Interview\nLog Recruiter Notes\nStatus: INITIAL_SCREENING]
    
    TA7 --> TA8[4. Client Endorsement\nSubmit Dossier to Client\nStatus: CLIENT_ENDORSEMENT]
    TA8 --> TA9[5. Client Final Interview\nStatus: FINAL_INTERVIEW]
    TA9 --> TA10[6. Compliance Verification\nReview Govt IDs & Medical\nStatus: COMPLIANCE]
    TA10 --> TA11([7. Create Deployment Record\nAssign Client, Rate & Start Date\nStatus: HIRED ➔ DEPLOYED])

    classDef purple fill:#6b21a8,stroke:#c084fc,stroke-width:2px,color:#ffffff;
    classDef ai fill:#312e81,stroke:#818cf8,stroke-width:2px,color:#ffffff;
    classDef success fill:#064e3b,stroke:#34d399,stroke-width:2px,color:#ffffff;
    classDef alt fill:#1e293b,stroke:#64748b,stroke-width:1.5px,color:#cbd5e1;

    class TA1,TA2,TA3,TA7,TA8,TA9,TA10 purple;
    class TA4 ai;
    class TA5,TA6 alt;
    class TA11 success;
```

---

## 3. ⚙️ Administrator Governance Flowchart

```mermaid
flowchart TD
    AD1([1. Admin Login]) --> AD2[1. User & Access Control\nManage staff accounts, roles & permissions]
    AD2 --> AD3[2. AI & Scoring Settings\nConfigure score weights & feature toggles]
    AD3 --> AD4[3. Clients & MRF Approvals\nRegister client companies & approve job requests]
    AD4 --> AD5[4. Compliance & Master Data\nSet required documents & skills list]
    
    AD5 --> AD6[5. Audit & Security Logs\nTrack user actions & system activity]
    AD5 --> AD7[6. Analytics & KPIs\nHiring speed, funnel stats & TA metrics]
    
    AD6 --> AD8([7. Reports & Oversight\nExport summary reports & tune policies])
    AD7 --> AD8

    classDef amber fill:#78350f,stroke:#fbbf24,stroke-width:2px,color:#ffffff;
    classDef dark fill:#1e293b,stroke:#f59e0b,stroke-width:1.5px,color:#fef3c7;
    classDef audit fill:#1e1b4b,stroke:#818cf8,stroke-width:2px,color:#ffffff;
    classDef bi fill:#064e3b,stroke:#34d399,stroke-width:2px,color:#ffffff;

    class AD1,AD8 amber;
    class AD2,AD3,AD4,AD5 dark;
    class AD6 audit;
    class AD7 bi;
```

---

## 4. 🌐 Multi-Role Summary

| Role | Core Focus | Key Responsibilities |
| :--- | :--- | :--- |
| 👤 **Applicant** | Candidate Job Journey | Profile setup, job applications, interview attendance, compliance document submission |
| 🎯 **Talent Acquisition (TA)** | Sourcing & Pipeline | MRF intake, candidate screening, AI score review, client endorsement, compliance checks |
| ⚙️ **Administrator** | Governance & Oversight | User RBAC, AI scoring setup, client & MRF approvals, audit logs, and KPI reporting |
