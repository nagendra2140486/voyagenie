"""Deterministic offline adapter.

Lets the full application be demonstrated without an LLM API key. Output shape
matches what the real adapters return so the UI needs no branching.
"""

from typing import Any

from .base import LLMProvider

BUDGET_DAILY_USD = {"low": 70, "medium": 160, "high": 340}

INTEREST_ACTIVITIES = {
    "food": ["a guided street-food walk", "a market breakfast crawl", "a hands-on local cooking class"],
    "history": ["the old-town heritage trail", "the national museum", "a guided walk through the historic quarter"],
    "nature": ["a sunrise viewpoint hike", "the botanical gardens", "a half-day nature reserve trip"],
    "shopping": ["the flagship shopping district", "a weekend artisan market", "a design-store browse"],
    "nightlife": ["a rooftop bar with skyline views", "a live-music venue in the old quarter", "a late-night food street"],
    "adventure": ["a kayaking or cycling half-day", "an outdoor climbing session", "a coastal day trip"],
    "art": ["the modern art museum", "a gallery district walk", "a street-art tour"],
    "relaxation": ["a spa afternoon", "a slow cafe morning", "a park picnic"],
}

GENERIC_ANCHORS = [
    "a slow wander along the main waterfront or riverside",
    "the city's signature viewpoint at golden hour",
    "a neighbourhood the guidebooks skip, on a local recommendation",
    "a half-day trip to a nearby town",
]

DAY_TEMPLATE = [
    ("Morning", "Start with {morning}."),
    ("Afternoon", "Continue with {afternoon}."),
    ("Evening", "Wind down with {evening}."),
]


def _rotate(items: list[str], index: int) -> str:
    return items[index % len(items)]


class MockProvider(LLMProvider):
    name = "mock"

    async def generate(
        self,
        *,
        feature: str,
        system_prompt: str,
        user_prompt: str,
        max_output_tokens: int,
        params: dict[str, Any],
    ) -> str:
        if feature == "itinerary":
            text = self._itinerary(params)
        elif feature == "budget":
            text = self._budget(params)
        else:
            text = self._chat(params)
        return self._truncate(text, max_output_tokens)

    @staticmethod
    def _truncate(text: str, max_output_tokens: int) -> str:
        limit = max_output_tokens * 4
        if len(text) <= limit:
            return text
        return text[:limit].rsplit("\n", 1)[0] + "\n\n_(response truncated by output token limit)_"

    def _itinerary(self, params: dict[str, Any]) -> str:
        destination = params.get("destination", "your destination")
        days = int(params.get("days", 3))
        budget = params.get("budget", "medium")
        travel_type = params.get("travel_type", "solo")
        interests = [i.lower() for i in params.get("interests", [])] or ["food", "history", "nature"]
        constraints = params.get("constraints", "")

        # Interleave across interests so a single day mixes themes instead of repeating one.
        by_interest = [
            INTEREST_ACTIVITIES.get(interest, [f"a {interest}-focused experience"]) for interest in interests
        ]
        pools = [
            options[round_index]
            for round_index in range(max(len(o) for o in by_interest))
            for options in by_interest
            if round_index < len(options)
        ]
        # Generic anchors keep multi-day plans varied even for a single interest.
        pools += GENERIC_ANCHORS

        daily = BUDGET_DAILY_USD.get(budget, 160)
        lines = [
            f"# {days}-Day {destination.title()} Itinerary",
            "",
            f"**Travel style:** {travel_type} · **Budget level:** {budget} "
            f"(~USD {daily}/day per person) · **Focus:** {', '.join(interests)}",
            "",
        ]
        if constraints:
            lines += [f"**Noted constraints:** {constraints}", ""]

        for day in range(1, days + 1):
            lines.append(f"## Day {day}")
            slots = {
                "morning": _rotate(pools, (day - 1) * 3),
                "afternoon": _rotate(pools, (day - 1) * 3 + 1),
                "evening": _rotate(pools, (day - 1) * 3 + 2),
            }
            for label, template in DAY_TEMPLATE:
                lines.append(f"- **{label}:** {template.format(**slots)}")
            lines.append(f"- **Estimated spend:** USD {daily} per person")
            lines.append("")

        lines += [
            "## Travel Tips",
            "- Book headline attractions online a few days ahead to skip queues.",
            "- Keep one afternoon flexible for weather or a local recommendation.",
            "- Cluster activities by neighbourhood to cut transport time.",
            "",
            f"**Estimated trip total:** USD {daily * days} per person, excluding flights.",
        ]
        return "\n".join(lines)

    def _budget(self, params: dict[str, Any]) -> str:
        destination = params.get("destination", "your destination")
        days = int(params.get("days", 3))
        amount = float(params.get("budget_amount", 1000))
        currency = params.get("currency", "USD")
        travellers = int(params.get("travellers", 1))
        style = params.get("travel_style", "balanced")

        split = {
            "Accommodation": 0.35,
            "Food & drink": 0.22,
            "Local transport": 0.12,
            "Activities & tours": 0.21,
            "Buffer & incidentals": 0.10,
        }
        if style == "luxury":
            split = {"Accommodation": 0.45, "Food & drink": 0.22, "Local transport": 0.08,
                     "Activities & tours": 0.17, "Buffer & incidentals": 0.08}
        elif style == "budget":
            split = {"Accommodation": 0.28, "Food & drink": 0.24, "Local transport": 0.14,
                     "Activities & tours": 0.22, "Buffer & incidentals": 0.12}

        per_day = amount / max(days, 1)
        per_person_day = per_day / max(travellers, 1)

        lines = [
            f"# Budget Plan: {destination.title()}",
            "",
            f"**Total budget:** {currency} {amount:,.0f} · **{days} days** · "
            f"**{travellers} traveller(s)** · **{style} style**",
            "",
            "## Suggested Expense Split",
            "",
            "| Category | Share | Total | Per day |",
            "| --- | --- | --- | --- |",
        ]
        for category, share in split.items():
            total = amount * share
            lines.append(
                f"| {category} | {share * 100:.0f}% | {currency} {total:,.0f} | {currency} {total / max(days, 1):,.0f} |"
            )

        lines += [
            "",
            f"**Daily allowance:** {currency} {per_day:,.0f} for the group "
            f"({currency} {per_person_day:,.0f} per person).",
            "",
            "## Recommendations to Stay Within Budget",
            "- Book accommodation with breakfast included to cut one meal per day.",
            "- Use day-pass public transport instead of taxis for city travel.",
            "- Pick two paid headline attractions; fill remaining days with free walks and viewpoints.",
            "- Eat the main meal at lunch, when set menus are cheaper than dinner.",
            f"- Keep {currency} {amount * split['Buffer & incidentals']:,.0f} untouched as a buffer for delays or upgrades.",
        ]
        return "\n".join(lines)

    def _chat(self, params: dict[str, Any]) -> str:
        message = str(params.get("message", "")).strip()
        lowered = message.lower()

        if any(word in lowered for word in ("visa", "passport")):
            body = (
                "Visa rules depend on your passport and length of stay. As a rule of thumb: check the "
                "official government portal of the destination, allow 3-4 weeks for processing, and keep "
                "six months of passport validity beyond your return date."
            )
        elif any(word in lowered for word in ("pack", "luggage", "clothes")):
            body = (
                "Pack in layers, keep one change of clothes plus medication in your cabin bag, and leave "
                "20% of your case empty for what you buy. A universal adapter, refillable bottle and a "
                "compact rain shell cover most destinations."
            )
        elif any(word in lowered for word in ("cheap", "budget", "save", "afford")):
            body = (
                "The biggest savings come from timing: travel in shoulder season, fly midweek, and book "
                "accommodation with a kitchen. Prioritise two paid experiences per city and keep the rest "
                "of the days free - walking tours, markets and viewpoints cost nothing."
            )
        elif any(word in lowered for word in ("family", "kids", "children")):
            body = (
                "For family trips, keep one base per city rather than moving daily, plan a single "
                "headline activity per day, and book accommodation near a metro stop. Afternoons free for "
                "pools or parks keep everyone happy."
            )
        elif any(word in lowered for word in ("best time", "season", "weather", "when")):
            body = (
                "Shoulder seasons - roughly April-June and September-October in the northern hemisphere - "
                "give you good weather, lower prices and fewer crowds. Avoid local public-holiday weeks, "
                "when prices spike."
            )
        else:
            body = (
                "Here is how I would approach that: pin down your dates and total budget first, then pick "
                "one region rather than several so travel time stays low. Build the trip around two or "
                "three anchor experiences and leave the rest loose - that is what makes a trip feel "
                "relaxed rather than rushed."
            )

        suggestion = (
            "\n\nWant me to turn this into a day-by-day plan? Open the **AI Trip Planner** and I will "
            "generate a full itinerary you can save to My Trips."
        )
        return f"{body}{suggestion}"
