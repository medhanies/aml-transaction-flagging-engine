"""Rules-based AML transaction monitoring engine.

Generates a synthetic retail-banking dataset with planted suspicious
patterns, runs a catalog of detection rules modeled on BSA/FinCEN
regulations, OFAC sanctions programs, and FATF guidance, scores the
results, and produces a SAR-candidate worklist.
"""

__version__ = "1.0.0"
