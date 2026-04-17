from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()


class Product(Base):
    __tablename__ = "product"
    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False, index=True)
    slug = Column(String, unique=True, index=True)
    image_path = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    ingredients = relationship("ProductIngredient", back_populates="product", cascade="all, delete-orphan")


class Ingredient(Base):
    __tablename__ = "ingredient"
    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False, unique=True, index=True)


class ProductIngredient(Base):
    __tablename__ = "product_ingredient"
    id = Column(Integer, primary_key=True)
    product_id = Column(Integer, ForeignKey("product.id", ondelete="CASCADE"), nullable=False)
    ingredient_id = Column(Integer, ForeignKey("ingredient.id", ondelete="CASCADE"), nullable=False)
    quantity = Column(String)

    product = relationship("Product", back_populates="ingredients")
    ingredient = relationship("Ingredient")
