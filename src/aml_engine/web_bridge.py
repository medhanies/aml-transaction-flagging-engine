"""JSON serialization utilities for web frontend integration."""

import json
from decimal import Decimal
from datetime import datetime


class DecimalEncoder(json.JSONEncoder):
    """Custom JSON encoder that handles Decimal types."""

    def default(self, o):
        if isinstance(o, Decimal):
            return float(o)
        if isinstance(o, datetime):
            return o.isoformat()
        return super().default(o)


def alerts_to_json(alerts):
    """Serialize Alert list to JSON string, handling Decimal amounts."""
    data = [
        {
            'alert_id': a.alert_id,
            'customer_id': a.customer_id,
            'rule_id': a.rule_id,
            'risk_tier': a.risk_tier,
            'risk_score': float(a.risk_score) if isinstance(a.risk_score, Decimal) else a.risk_score,
            'description': a.description,
            'flagged_amount': float(a.flagged_amount) if isinstance(a.flagged_amount, Decimal) else a.flagged_amount,
            'affected_accounts': a.affected_accounts,
            'temporal_context': a.temporal_context
        }
        for a in alerts
    ]
    return json.dumps(data, cls=DecimalEncoder)


def customer_risks_to_json(customer_risks):
    """Serialize CustomerRisk list to JSON string."""
    data = [
        {
            'customer_id': cr.customer_id,
            'name': cr.name,
            'risk_score': float(cr.risk_score) if isinstance(cr.risk_score, Decimal) else cr.risk_score,
            'risk_tier': cr.risk_tier,
            'rules_triggered': cr.rules_triggered,
            'flagged_amount': float(cr.flagged_amount) if isinstance(cr.flagged_amount, Decimal) else cr.flagged_amount,
            'num_accounts': cr.num_accounts,
            'activity_summary': cr.activity_summary
        }
        for cr in customer_risks
    ]
    return json.dumps(data, cls=DecimalEncoder)
