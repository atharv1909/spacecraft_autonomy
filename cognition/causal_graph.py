from dataclasses import dataclass
from typing import Dict, List, Optional

# Directed edges reflect the ACTUAL physical coupling already present in
# action/physics.py's _thermal_derivatives / _power_derivatives / 
# _life_support_derivatives. Keep this graph in sync with physics.py if
# the coupling model changes.
SUBSYSTEM_GRAPH: Dict[str, List[str]] = {
    "thermal":       ["power"],        # radiator failure -> solar panel derating via thermal exposure term
    "power":         ["life_support"], # battery/load derating -> O2 gen / CO2 scrub rate depends on power budget
    "life_support":  [],               # terminal node
}

@dataclass
class SubsystemState:
    name: str
    severity: str   # "nominal" | "degraded" | "critical" | "failed"

SEVERITY_RANK = {"nominal": 0, "degraded": 1, "critical": 2, "failed": 3}

def find_root_cause(states: Dict[str, SubsystemState]) -> dict:
    """
    Given current severities for each subsystem, walk the causal graph
    upstream-to-downstream and identify the earliest (most upstream)
    subsystem that is at or above 'critical' — that's the root cause,
    not the symptom.
    """
    critical_nodes = [
        name for name, s in states.items()
        if SEVERITY_RANK.get(s.severity if isinstance(s, SubsystemState) else str(s), 0) >= SEVERITY_RANK["critical"]
    ]
    if not critical_nodes:
        return {"root_cause": None, "cascade": [], "narrative": "All subsystems nominal."}

    # A node is a "root" if none of its upstream parents are also critical
    parents = {
        child: parent for parent, children in SUBSYSTEM_GRAPH.items()
        for child in children
    }

    roots = [
        n for n in critical_nodes
        if parents.get(n) not in critical_nodes
    ]

    if not roots:
        roots = critical_nodes

    # Walk downstream from each root to build the cascade chain
    def downstream_chain(root):
        chain = [root]
        frontier = SUBSYSTEM_GRAPH.get(root, [])
        while frontier:
            nxt = [f for f in frontier if f in critical_nodes]
            if not nxt:
                break
            chain.extend(nxt)
            frontier = [g for f in nxt for g in SUBSYSTEM_GRAPH.get(f, [])]
        return chain

    chains = [downstream_chain(r) for r in roots]
    primary_chain = max(chains, key=len)  # longest cascade = most explanatory

    def _get_sev(name):
        s = states.get(name)
        if isinstance(s, SubsystemState):
            return s.severity
        return str(s)

    narrative = " -> ".join(
        f"{node} ({_get_sev(node)})" for node in primary_chain
    )
    return {
        "root_cause": primary_chain[0],
        "cascade": primary_chain,
        "narrative": f"ROOT CAUSE: {narrative}. Address {primary_chain[0]}, not the downstream symptoms."
    }
