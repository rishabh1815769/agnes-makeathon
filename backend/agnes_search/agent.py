from pathlib import Path
import sqlite3

from google.adk.agents.llm_agent import Agent
from google.adk.tools import google_search

BASE_DIR = Path(__file__).resolve().parent
INSTRUCTION_PATH = BASE_DIR / "instruct.txt"
DB_PATH = BASE_DIR.parent / "database" / "db.sqlite"


def load_material_profile() -> str:
    if not DB_PATH.exists():
        return f"Material profile database not found at: {DB_PATH}"

    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            rows = cursor.execute(
                """
                SELECT material_profile
                FROM Supplier_Product
                WHERE material_profile IS NOT NULL
                  AND TRIM(material_profile) <> ''
                """
            ).fetchall()
    except sqlite3.Error as exc:
        return f"Could not read material profile from database: {exc}"

    if not rows:
        return "No material_profile data found in Supplier_Product."

    return "\n\n".join(row[0] for row in rows)


instruction_template = INSTRUCTION_PATH.read_text(encoding="utf-8").strip()
material_profile = load_material_profile()
INSTRUCTION_TEXT = instruction_template.replace("material_profile", material_profile)

root_agent = Agent(
    model="gemini-2.5-flash-lite",
    name="raw_material_search_agent",
    instruction=INSTRUCTION_TEXT,
    description="Make sure to follow the instructions carefully and use the provided tools to find the information needed.",
    tools=[google_search],
)
