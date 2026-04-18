from pathlib import Path
import sqlite3

from google.adk.agents.llm_agent import Agent
from google.adk.tools import google_search

BASE_DIR = Path(__file__).resolve().parent
INSTRUCTION_PATH = BASE_DIR / "instruct.txt"
DB_PATH = BASE_DIR.parent / "database" / "db.sqlite"


def load_material_profiles_bulk(pairs: list[tuple[int, int]]) -> list[dict]:
    """
    pairs: [(product_id, supplier_id), ...]
    returns: [{product_id, supplier_id, sku, supplier, material_profile}, ...]
    """
    import sqlite3

    if not pairs:
        return []

    placeholders = ",".join(["(?, ?)"] * len(pairs))
    flat_values = [item for pair in pairs for item in pair]

    query = f"""
        SELECT 
            sp.material_profile
        FROM Supplier_Product sp
        JOIN Product p ON sp.ProductId = p.id
        JOIN Supplier s ON sp.SupplierId = s.id
        WHERE (sp.ProductId, sp.SupplierId) IN ({placeholders})
          AND sp.material_profile IS NOT NULL
          AND TRIM(sp.material_profile) <> ''
    """

    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()
        rows = cur.execute(query, flat_values).fetchall()

    return [
        {
            "product_id": row["ProductId"],
            "supplier_id": row["SupplierId"],
            "material_profile": row["material_profile"]
        }
        for row in rows
    ]

def load_material_profile(p_id: str, s_id: str) -> str:
    if not DB_PATH.exists():
        return f"Material profile database not found at: {DB_PATH}"

    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            rows = cursor.execute(
                """
                SELECT sp.material_profile
                FROM Supplier_Product sp
                JOIN Supplier s ON sp.SupplierId = s.id
                JOIN Product p ON sp.ProductId = p.id
                WHERE p.id = ? AND s.id = ?
                AND sp.material_profile IS NOT NULL
                AND TRIM(sp.material_profile) <> ''
                """
            , (p_id, s_id)).fetchall()
    except sqlite3.Error as exc:
        return f"Could not read material profile from database: {exc}"

    if not rows:
        return "No material_profile data found in Supplier_Product."

    return "\n\n".join(row[0] for row in rows)
