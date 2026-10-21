"""One-event shared-HDB cooking-smell and cookware-boundary scenario."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Optional

from tinytroupe.agent import TinyPerson
from tinytroupe.environment import TinyWorld


DEFAULT_INITIAL_DATETIME = datetime(2026, 10, 24, 19, 15)
WORLD_NAME = "Clementi Shared HDB Kitchen"
WORLD_DESCRIPTION = (
    "A shared HDB flat kitchen and adjoining corridor in Clementi during the "
    "evening. The exhaust fan works, the kitchen window can be opened, and no "
    "cookware-separation agreement currently exists. Four housemates are home, "
    "and there has been no earlier dispute about this meal."
)
PERSONA_FILES = {
    "cook": "alex_tan.agent.json",
    "sensitive_housemate": "nadia_rahman.agent.json",
    "practical_housemate": "benjamin_koh.agent.json",
    "conflict_averse_housemate": "kavitha_rajan.agent.json",
}
PRINCIPAL_PARTICIPANTS = ("cook", "sensitive_housemate")


@dataclass(frozen=True)
class HDBEventState:
    key: str
    started_at: datetime
    summary: str


def create_participants() -> dict[str, TinyPerson]:
    persona_dir = Path(__file__).resolve().parent / "personas"
    return {
        key: TinyPerson.load_specification(str(persona_dir / filename))
        for key, filename in PERSONA_FILES.items()
    }


class SharedKitchenWorld(TinyWorld):
    """Face-to-face kitchen conversation where both residents hear all speech."""

    def _handle_talk(self, source_agent: TinyPerson, content: str, target: str):
        self.broadcast(content, source=source_agent)


class HDBSpaceScenario:
    def __init__(self, initial_datetime: Optional[datetime] = None):
        self.participants = create_participants()
        self.world = SharedKitchenWorld(
            WORLD_NAME,
            list(self.participants.values()),
            initial_datetime=initial_datetime or DEFAULT_INITIAL_DATETIME,
            broadcast_if_no_target=True,
        )
        self.event_state: Optional[HDBEventState] = None
        for participant in self.participants.values():
            participant.move_to(
                "the shared kitchen",
                context=[WORLD_DESCRIPTION],
            )
        for source_key, source in self.participants.items():
            for target_key, target in self.participants.items():
                if source_key != target_key:
                    source.make_agent_accessible(target, "Your housemate.")

    def trigger(self) -> HDBEventState:
        if self.event_state is not None:
            raise RuntimeError("The HDB cooking event has already been triggered.")
        summary = (
            "Alex begins cooking a strongly aromatic pork curry in an ordinary "
            "shared frying pan; Nadia enters as the smell spreads from the kitchen."
        )
        self.event_state = HDBEventState(
            key="aromatic_pork_curry_in_shared_kitchen",
            started_at=self.world.current_datetime,
            summary=summary,
        )
        self.participants["cook"].socialize(
            "You are midway through cooking a strongly aromatic pork curry in an "
            "ordinary shared frying pan. The exhaust fan is currently off and the "
            "window is closed. There has never been a household agreement separating "
            "cookware. Nadia has just entered the kitchen. Do not assume what she "
            "thinks until she communicates it.",
            source=self.world,
        )
        self.participants["sensitive_housemate"].socialize(
            "You enter the shared kitchen and see Alex cooking pork curry in an "
            "ordinary shared frying pan. A heavy aroma is spreading toward the "
            "bedrooms. The exhaust fan is off and the window is closed. There has "
            "never been a household agreement separating cookware. You are concerned "
            "about lingering odour and future pork cross-contact, but do not assume "
            "Alex intended disrespect.",
            source=self.world,
        )
        self.participants["practical_housemate"].socialize(
            "You walk from the living room toward the kitchen after smelling a "
            "strong pork curry. You see Alex cooking in an ordinary shared frying "
            "pan, with the exhaust fan off and window closed, and Nadia has just "
            "entered. You know there has never been a household agreement separating "
            "cookware. You did not hear either person's private thoughts and cannot "
            "settle the issue on their behalf.",
            source=self.world,
        )
        self.participants["conflict_averse_housemate"].socialize(
            "You come out of your room because a strong curry smell is spreading "
            "through the flat. You see Alex cooking pork curry in an ordinary shared "
            "pan, the exhaust fan off and window closed, while Nadia enters. No "
            "cookware-separation agreement exists. You do not know either person's "
            "intentions and cannot accept an arrangement on their behalf.",
            source=self.world,
        )
        return self.event_state


def create_scenario(initial_datetime: Optional[datetime] = None) -> HDBSpaceScenario:
    return HDBSpaceScenario(initial_datetime=initial_datetime)


__all__ = [
    "DEFAULT_INITIAL_DATETIME",
    "HDBEventState",
    "HDBSpaceScenario",
    "PERSONA_FILES",
    "PRINCIPAL_PARTICIPANTS",
    "WORLD_DESCRIPTION",
    "WORLD_NAME",
    "create_participants",
    "create_scenario",
]

