/* ============================================================
   DATABASE: REVIEW_SERVICE

   Canonical store for learner ratings/reviews on published study
   plans (Creator Mode) and abuse reports (plan + review targets).

   BRD alignment:
   - FR-039 — Creator dashboard aggregates (review stats feed catalog rollup)
   - FR-043 — Post–plan-completion rating prompt (certificate context)
   - FR-044 — Flag plan OR reviews with reason categories + moderation states

   Cross-service logical FKs (no DB enforce):
   - USERID → AUTH identity
   - PLANID / PLANVERSION → CREATOR_SERVICE.dbo.STUDY_PLAN
   - ENROLLMENTID → ENROLLMENT_SERVICE.dbo.ENROLLMENT (optional correlation)

   Execute on an existing database (recommended name: REVIEW_SERVICE).
   If the database does not exist, run:
       CREATE DATABASE [REVIEW_SERVICE];
   then run this script with USE below.

   ============================================================ */

USE [REVIEW_SERVICE];
GO
SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO


/* ----------------------------------------------------------
   1. PLAN_USER_REVIEW
   One active review row per learner per PLANID (editable).
   PLANVERSION snapshots the published plan version reviewed.
   Moderation hides content from public list without deleting row.
   ---------------------------------------------------------- */

CREATE TABLE [dbo].[PLAN_USER_REVIEW] (
    [REVIEWID]          BIGINT IDENTITY(1,1) NOT NULL,
    [USERID]            BIGINT NOT NULL,
    [PLANID]            BIGINT NOT NULL,
    [PLANVERSION]       INT    NOT NULL,
    /* Optional linkage for audit / eligibility correlation with Enrollment */
    [ENROLLMENTID]      BIGINT NULL,

    [RATING]            TINYINT NOT NULL,

    /* Optional headline + body (SCREEN L6: optional brief text) */
    [TITLE]             NVARCHAR(200)  NULL,
    [BODY]              NVARCHAR(4000) NULL,

    /* VISIBLE — shown in catalog; UNDER_REVIEW / HIDDEN_ADMIN / REMOVED_BY_USER */
    [VISIBILITYSTATUS]  NVARCHAR(30) NOT NULL,

    /* Eligibility attribution: reviewer completed enrollment pathway */
    [SUBMITTEDAFTERCOMPLETE] BIT NOT NULL,

    [CREATEDDATE]       DATETIME2(7) NOT NULL,
    [UPDATEDDATE]       DATETIME2(7) NULL,

    CONSTRAINT [PK_PLAN_USER_REVIEW] PRIMARY KEY CLUSTERED ([REVIEWID] ASC),
    CONSTRAINT [UQ_PUR_USER_PLAN] UNIQUE ([USERID], [PLANID]),
    CONSTRAINT [CHK_PUR_RATING] CHECK ([RATING] BETWEEN 1 AND 5),
    CONSTRAINT [CHK_PUR_VISIBILITY]
        CHECK ([VISIBILITYSTATUS] IN (
            N'VISIBLE', N'UNDER_REVIEW', N'HIDDEN_ADMIN',
            N'REMOVED_BY_USER'
        ))
);
GO

ALTER TABLE [dbo].[PLAN_USER_REVIEW]
    ADD CONSTRAINT [DF_PUR_VISIBILITY] DEFAULT (N'VISIBLE') FOR [VISIBILITYSTATUS];
GO
ALTER TABLE [dbo].[PLAN_USER_REVIEW]
    ADD CONSTRAINT [DF_PUR_COMPLETE] DEFAULT ((1)) FOR [SUBMITTEDAFTERCOMPLETE];
GO
ALTER TABLE [dbo].[PLAN_USER_REVIEW]
    ADD CONSTRAINT [DF_PUR_CREATED] DEFAULT (SYSUTCDATETIME()) FOR [CREATEDDATE];
GO

CREATE NONCLUSTERED INDEX [IX_PUR_PLAN_VISIBLE]
    ON [dbo].[PLAN_USER_REVIEW] ([PLANID], [VISIBILITYSTATUS])
    INCLUDE ([RATING], [CREATEDDATE]);
GO

CREATE NONCLUSTERED INDEX [IX_PUR_USER]
    ON [dbo].[PLAN_USER_REVIEW] ([USERID]);
GO


/* ----------------------------------------------------------
   2. REVIEW_REPORT
   Flag abusive or policy-violating *reviews* (FR-044).
   ---------------------------------------------------------- */

CREATE TABLE [dbo].[REVIEW_REPORT] (
    [REPORTID]           BIGINT IDENTITY(1,1) NOT NULL,
    [REVIEWID]           BIGINT NOT NULL,
    [REPORTEDBYUSERID]   BIGINT NOT NULL,

    [REASONCODE]         NVARCHAR(50)  NOT NULL,
    [DETAIL]             NVARCHAR(2000) NULL,

    [STATUS]             NVARCHAR(20) NOT NULL,
    /* OPEN → RESOLVED | DISMISSED */

    [CREATEDDATE]        DATETIME2(7) NOT NULL,
    [RESOLVEDDATE]       DATETIME2(7) NULL,
    [MODERATORUSERID]    BIGINT NULL,
    [MODERATORNOTE]      NVARCHAR(1000) NULL,

    CONSTRAINT [PK_REVIEW_REPORT] PRIMARY KEY CLUSTERED ([REPORTID] ASC),
    CONSTRAINT [FK_RR_REVIEW]
        FOREIGN KEY ([REVIEWID]) REFERENCES [dbo].[PLAN_USER_REVIEW]([REVIEWID]),
    CONSTRAINT [CHK_RR_STATUS] CHECK ([STATUS] IN (
        N'OPEN', N'RESOLVED', N'DISMISSED'
    ))
);
GO

ALTER TABLE [dbo].[REVIEW_REPORT]
    ADD CONSTRAINT [DF_RR_CREATED] DEFAULT (SYSUTCDATETIME()) FOR [CREATEDDATE];
GO
ALTER TABLE [dbo].[REVIEW_REPORT]
    ADD CONSTRAINT [DF_RR_STATUS] DEFAULT (N'OPEN') FOR [STATUS];
GO

CREATE NONCLUSTERED INDEX [IX_RR_REVIEW_OPEN]
    ON [dbo].[REVIEW_REPORT]([REVIEWID], [STATUS]);
GO


/* ----------------------------------------------------------
   3. PLAN_CONTENT_REPORT
   Flag the *study plan listing / content* (not tied to one review).
   ---------------------------------------------------------- */

CREATE TABLE [dbo].[PLAN_CONTENT_REPORT] (
    [REPORTID]           BIGINT IDENTITY(1,1) NOT NULL,
    [PLANID]             BIGINT NOT NULL,
    [REPORTEDBYUSERID]   BIGINT NOT NULL,

    [REASONCODE]         NVARCHAR(50)  NOT NULL,
    [DETAIL]             NVARCHAR(2000) NULL,

    [STATUS]             NVARCHAR(20) NOT NULL,

    [CREATEDDATE]        DATETIME2(7) NOT NULL,
    [RESOLVEDDATE]       DATETIME2(7) NULL,
    [MODERATORUSERID]    BIGINT NULL,
    [MODERATORNOTE]      NVARCHAR(1000) NULL,

    CONSTRAINT [PK_PLAN_CONTENT_REPORT] PRIMARY KEY CLUSTERED ([REPORTID] ASC),
    CONSTRAINT [CHK_PCR_STATUS] CHECK ([STATUS] IN (
        N'OPEN', N'RESOLVED', N'DISMISSED'
    ))
);
GO

ALTER TABLE [dbo].[PLAN_CONTENT_REPORT]
    ADD CONSTRAINT [DF_PCR_CREATED] DEFAULT (SYSUTCDATETIME()) FOR [CREATEDDATE];
GO
ALTER TABLE [dbo].[PLAN_CONTENT_REPORT]
    ADD CONSTRAINT [DF_PCR_STATUS] DEFAULT (N'OPEN') FOR [STATUS];
GO

CREATE NONCLUSTERED INDEX [IX_PCR_PLAN_OPEN]
    ON [dbo].[PLAN_CONTENT_REPORT]([PLANID], [STATUS]);
GO
