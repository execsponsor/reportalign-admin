-- Migration: Create platform_config table for storing organization creation defaults
-- Run this against the shared PostgreSQL database

CREATE TABLE IF NOT EXISTS platform_config (
  config_key    VARCHAR(100) PRIMARY KEY,
  config_value  JSONB NOT NULL,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by    UUID REFERENCES super_administrators(id)
);

-- Seed the organization creation defaults (extracted from hardcoded values)
INSERT INTO platform_config (config_key, config_value)
VALUES ('organization_defaults', '{
  "organization_settings": {
    "terminology_config": {
      "programme": "Programme",
      "programmes": "Programmes",
      "workstream": "Workstream",
      "workstreams": "Workstreams"
    },
    "rag_definitions": {
      "red": {
        "description": "Critical issues requiring immediate attention",
        "label": "Critical"
      },
      "amber": {
        "description": "Some risks or concerns identified",
        "label": "At Risk"
      },
      "green": {
        "description": "On track and progressing as planned",
        "label": "On Track"
      }
    },
    "outcome_framework": "Balanced Scorecard",
    "fiscal_year_start_month": 4,
    "user_visibility_mode": "all",
    "author_can_create_programmes": false,
    "functionality_visibility": {
      "strategic_goals_enabled": false,
      "milestones_enabled": false,
      "workstreams_enabled": false,
      "business_case_enabled": false,
      "risk_issue_register_enabled": false,
      "action_tracking_enabled": false,
      "meeting_management_enabled": false,
      "assurance_enabled": false,
      "communications_enabled": false,
      "briefings_enabled": false,
      "knowledge_hub_enabled": false,
      "community_hub_enabled": false
    }
  },
  "portfolio_grouping": {
    "grouping_enabled": false,
    "level_1_enabled": false,
    "level_1_name": "Division",
    "level_2_enabled": false,
    "level_2_name": "Department"
  },
  "admin_primary_role": "executive",
  "primary_brand_color": "#1E40AF",
  "workflow_steps": [
    { "name": "Draft", "sequence_order": 1, "is_initial": true, "is_terminal": false, "terminal_type": null, "color": "#6B7280" },
    { "name": "In Review", "sequence_order": 2, "is_initial": false, "is_terminal": false, "terminal_type": null, "color": "#3B82F6" },
    { "name": "Submitted", "sequence_order": 3, "is_initial": false, "is_terminal": false, "terminal_type": null, "color": "#EAB308" },
    { "name": "Approved", "sequence_order": 4, "is_initial": false, "is_terminal": true, "terminal_type": "approved", "color": "#22C55E" },
    { "name": "Rejected", "sequence_order": 5, "is_initial": false, "is_terminal": true, "terminal_type": "rejected", "color": "#EF4444" }
  ],
  "workflow_transitions": [
    { "from_step": "Draft", "to_step": "In Review", "button_label": "Submit for Review", "button_variant": "outline", "allowed_roles": ["Owner", "Contributor"] },
    { "from_step": "Draft", "to_step": "Submitted", "button_label": "Submit for Approval", "button_variant": "default", "allowed_roles": ["Owner", "Contributor"] },
    { "from_step": "In Review", "to_step": "Draft", "button_label": "Return to Draft", "button_variant": "outline", "allowed_roles": ["Executive", "Owner"] },
    { "from_step": "In Review", "to_step": "Submitted", "button_label": "Submit for Approval", "button_variant": "default", "allowed_roles": ["Owner", "Contributor"] },
    { "from_step": "Submitted", "to_step": "Approved", "button_label": "Approve", "button_variant": "success", "allowed_roles": ["Executive"] },
    { "from_step": "Submitted", "to_step": "Rejected", "button_label": "Reject", "button_variant": "destructive", "allowed_roles": ["Executive"] },
    { "from_step": "Submitted", "to_step": "In Review", "button_label": "Request Changes", "button_variant": "secondary", "allowed_roles": ["Executive"] }
  ],
  "default_indicators": [
    { "name": "Scope", "category": "scope", "description": "Tracks whether the project scope is being delivered as planned" },
    { "name": "Schedule", "category": "time", "description": "Monitors timeline adherence and milestone completion" },
    { "name": "Cost", "category": "cost", "description": "Tracks budget performance and financial health" },
    { "name": "Quality", "category": "quality", "description": "Measures deliverable quality and defect rates" },
    { "name": "Risk", "category": "risk", "description": "Assesses overall risk exposure and mitigation effectiveness" },
    { "name": "Benefits", "category": "benefit", "description": "Tracks benefits realization and value delivery" }
  ],
  "default_report_template": {
    "name": "Standard Report",
    "description": "Default reporting template for new organizations",
    "sections": [
      { "id": "reportInfo", "label": "Report Information", "description": "Basic report metadata and submission details", "visible": true, "order": 0, "required": true },
      { "id": "statusSummary", "label": "Overall Status Summary", "description": "Executive summary and overall RAG status", "visible": true, "order": 1, "required": true },
      { "id": "indicators", "label": "Key Indicators", "description": "Performance indicators with RAG status", "visible": true, "order": 2, "required": true },
      { "id": "progress", "label": "Progress Made", "description": "Achievements and progress in this period", "visible": true, "order": 3 },
      { "id": "programmeRisksIssues", "label": "Programme Risks & Issues", "description": "Risks and issues from the programme register", "visible": true, "order": 4 },
      { "id": "decisions", "label": "Decisions Required", "description": "Decisions needed from stakeholders", "visible": true, "order": 5 },
      { "id": "nextPeriod", "label": "Next Period Activities", "description": "Planned activities for the next period", "visible": true, "order": 6 },
      { "id": "milestones", "label": "Milestones", "description": "Key milestone status and dates", "visible": true, "order": 7 },
      { "id": "routeToGreen", "label": "Route to Green", "description": "Recovery plan to return the programme to green status", "visible": true, "order": 8 },
      { "id": "financial", "label": "Financial Summary", "description": "Budget vs actual financial performance", "visible": false, "order": 9 },
      { "id": "attachments", "label": "Attachments", "description": "Supporting documents and files", "visible": true, "order": 10 }
    ],
    "indicator_fields_config": { "show_current": true, "show_target": true, "show_trend": true }
  }
}'::jsonb)
ON CONFLICT (config_key) DO NOTHING;
