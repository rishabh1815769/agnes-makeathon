from pathlib import Path
import sqlite3

from BM25 import BM25Search
from google.adk.agents.llm_agent import Agent

BASE_DIR = Path(__file__).resolve().parent
INSTRUCTION_PATH = BASE_DIR / "instruct.txt"
DB_PATH = BASE_DIR.parent / "database" / "db.sqlite"

def load_material_profiles_bulk(items: list[dict]) -> list[dict]:
    """
    items: [{"product_id": int, "supplier_id": int}, ...]
    returns: [{product_id, supplier_id, sku, supplier, material_profile}, ...]
    """
    import sqlite3

    if not items:
        return []

    pairs: list[tuple[int, int]] = []
    for item in items:
        product_id = item.get("product_id")
        supplier_id = item.get("supplier_id")
        if product_id is None or supplier_id is None:
            continue
        pairs.append((int(product_id), int(supplier_id)))

    if not pairs:
        return []

    placeholders = ",".join(["(?, ?)"] * len(pairs))
    flat_values = [item for pair in pairs for item in pair]

    query = f"""
        SELECT
            sp.ProductId AS ProductId,
            sp.SupplierId AS SupplierId,
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


def find_similar_material(material: str) -> list[dict]:
    """
    Find similar materials using BM25 on material names, then load material_profile
    for the top matches via load_material_profiles_bulk((ProductId, SupplierId), ...).
    """
    query = material.strip()
    if not query or not DB_PATH.exists():
        return []

    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            rows = cursor.execute(
                """
                SELECT p.Id AS ProductId, sp.SupplierId, p.material_name AS material_name
                FROM Product p
                JOIN Supplier_Product sp ON p.id = sp.ProductId
                WHERE p.material_name IS NOT NULL
                  AND TRIM(p.material_name) <> ''
                """
            ).fetchall()
    except sqlite3.Error:
        return []

    if not rows:
        return []

    pairs = [(int(row[0]), int(row[1])) for row in rows]
    corpus = [row[2] for row in rows]
    searcher = BM25Search(corpus=corpus)
    results = searcher.search([query], k=min(5, len(corpus)))

    if not results:
        return []

    top_results = results[0]
    top_pairs = [pairs[int(r["id"])] for r in top_results]
    top_items = [
        {"product_id": product_id, "supplier_id": supplier_id}
        for product_id, supplier_id in top_pairs
    ]
    score_by_pair = {
        pairs[int(r["id"])]: float(r["score"]) for r in top_results
    }

    profiles = load_material_profiles_bulk(top_items)
    for row in profiles:
        key = (row["product_id"], row["supplier_id"])
        row["bm25_score"] = score_by_pair.get(key, 0.0)
    return profiles

root_agent = Agent(
    model='gemini-3.1-flash-lite-preview',
    name='agnes_agent',
    description='Make sure to follow the instructions carefully and use the provided tools to find the information needed',
    instruction=INSTRUCTION_PATH.read_text(encoding='utf-8'),
    tools=[find_similar_material],
)
