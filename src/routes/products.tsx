import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Search, X } from "lucide-react";
import { useStore, fmtMoney, formatUnits } from "@/lib/store";
import { normalizeCategories, normalizeCategoryName, sameCategoryName } from "@/lib/categories";
import {
  getDisplayStockUnitQuantity,
  getDisplaySubUnitQuantity,
  formatProductSaleUnits,
  getSaleUnitConversionNote,
  getProductSaleUnitOptions,
  getProductSaleSubUnitOptions,
  isThangSorDomKhlokProduct,
} from "@/lib/sale-units";
import { primaryUnit, UNIT_OPTIONS } from "@/lib/units";
import { PageHeader, PageSection, StockBadge } from "@/components/app/StatCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  compareTextWithAscendingNumbers,
  displayZeroAsPlaceholder,
  normalizeLocalizedDigits,
  parseNumericInput,
} from "@/lib/utils";
import { toast } from "sonner";
import type {
  Product,
  ProductCategory,
  ProductSaleSubUnit,
  ProductVariant,
  UnitType,
} from "@/lib/types";

export const Route = createFileRoute("/products")({ component: ProductsPage });

const UNITS: UnitType[] = UNIT_OPTIONS;

type CategoryMutationResult = { ok: true } | { ok: false; error: string };

function getCategoryDefaultUnit(
  categories: ProductCategory[],
  categoryName: string,
  fallback: UnitType = "បេ",
) {
  const selectedCategory = categories.find((item) => sameCategoryName(item.name, categoryName));
  return selectedCategory?.defaultUnit ?? fallback;
}

type SuggestedSaleUnitConfig = {
  unit: UnitType;
  suggestedQuantityPerStockUnit?: number;
};

function sanitizeSaleSubUnits(saleSubUnits: ProductSaleSubUnit[], stockUnit: UnitType) {
  const seen = new Set<UnitType>();

  return saleSubUnits.filter((saleSubUnit) => {
    if (saleSubUnit.unit === stockUnit) return false;
    if (seen.has(saleSubUnit.unit)) return false;

    seen.add(saleSubUnit.unit);
    return true;
  });
}

function getRecommendedSaleUnitConfigs(
  categoryName: string,
  stockUnit: UnitType,
  productName: string,
) {
  const normalizedCategoryName = normalizeCategoryName(categoryName);
  const isThangSorDomBagCategory =
    normalizedCategoryName.includes("ថង់សរដុំ") || normalizedCategoryName.includes("ថង់ខ្មៅដុំ");
  const isFoamDishCategory =
    normalizedCategoryName.includes("ចានស្នោ") || normalizedCategoryName.includes("ចាន់ស្នោ");
  const suggestions: SuggestedSaleUnitConfig[] = [];

  if (stockUnit === "បេ") {
    if (isThangSorDomBagCategory || isThangSorDomKhlokProduct(productName)) {
      suggestions.push({
        unit: "កញ្ចប់",
        suggestedQuantityPerStockUnit: isThangSorDomKhlokProduct(productName) ? 50 : undefined,
      });
    }

    if (isFoamDishCategory) {
      suggestions.push({ unit: "យួ" });
      suggestions.push({ unit: "ដុំ" });
    }

    if (normalizedCategoryName.includes("កៅស៊ូ")) {
      suggestions.push({ unit: "kg" });
    }
  }

  if (stockUnit === "កេស") {
    suggestions.push({ unit: "យួ" });
  }

  const uniqueSuggestions = new Map<UnitType, SuggestedSaleUnitConfig>();
  for (const suggestion of suggestions) {
    if (suggestion.unit === stockUnit || uniqueSuggestions.has(suggestion.unit)) continue;
    uniqueSuggestions.set(suggestion.unit, suggestion);
  }

  return Array.from(uniqueSuggestions.values());
}

function getInitialSaleSubUnits(product: Product | null) {
  if (!product) return [];
  return sanitizeSaleSubUnits(getProductSaleSubUnitOptions(product), primaryUnit(product.unit));
}

function getSaleSubUnitParentLabel(
  stockUnit: UnitType,
  saleSubUnits: ProductSaleSubUnit[],
  index: number,
) {
  return index === 0 ? stockUnit : saleSubUnits[index - 1]?.unit ?? stockUnit;
}

function ProductsPage() {
  const {
    state,
    addCategory,
    updateCategory,
    deleteCategory,
    upsertProduct,
    deleteProduct,
    addVariant,
    removeVariant,
  } = useStore();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [editing, setEditing] = useState<Product | null>(null);
  const [open, setOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);

  const categories = useMemo(
    () => normalizeCategories(state.categories, state.products),
    [state.categories, state.products],
  );
  const categoryNames = useMemo(() => categories.map((item) => item.name), [categories]);

  useEffect(() => {
    if (category === "all") return;
    if (!categories.some((item) => sameCategoryName(item.name, category))) setCategory("all");
  }, [category, categories]);

  const filtered = useMemo(
    () =>
      [...state.products]
        .filter((product) => {
          if (category !== "all" && !sameCategoryName(product.category, category)) return false;
          if (search && !product.name.toLowerCase().includes(search.toLowerCase())) return false;
          return true;
        })
        .sort((left, right) => compareTextWithAscendingNumbers(left.name, right.name)),
    [category, search, state.products],
  );
  const editingVariantProduct = useMemo(
    () => (editing ? state.products.find((product) => product.id === editing.id) ?? editing : null),
    [editing, state.products],
  );

  const openNew = () => {
    setEditing(null);
    setOpen(true);
  };
  const openEdit = (product: Product) => {
    setEditing(product);
    setOpen(true);
  };

  const onAddCategory = (nextCategory: ProductCategory): CategoryMutationResult => {
    const result = addCategory(nextCategory);
    if (!result.ok) toast.error(result.error);
    return result;
  };

  const onUpdateCategory = (
    currentName: string,
    nextCategory: ProductCategory,
  ): CategoryMutationResult => {
    const result = updateCategory(currentName, nextCategory);
    if (!result.ok) toast.error(result.error);
    return result;
  };

  const onDeleteCategory = (name: string): CategoryMutationResult => {
    const result = deleteCategory(name);
    if (!result.ok) toast.error(result.error);
    return result;
  };

  return (
    <div>
      <PageHeader
        title="Products"
        description="Manage products, categories, stock alerts, and units in one place."
        actions={
          <div className="flex flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setCategoryOpen(true)}>
              Manage Categories
            </Button>
            <Button onClick={openNew}>
              <Plus className="h-4 w-4 mr-1" />
              Add Product
            </Button>
          </div>
        }
      />
      <PageSection>
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products..."
              className="pl-9"
            />
          </div>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="sm:w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {categoryNames.map((item) => (
                <SelectItem key={item} value={item}>
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="overflow-x-auto -mx-5">
          <table className="w-full text-sm min-w-[800px]">
            <thead>
              <tr className="text-left text-xs uppercase text-muted-foreground border-b border-border">
                <th className="px-5 py-2 font-medium">Name</th>
                <th className="px-5 py-2 font-medium">Category</th>
                <th className="px-5 py-2 font-medium">Unit</th>
                <th className="px-5 py-2 font-medium text-right">Stock</th>
                <th className="px-5 py-2 font-medium text-right">Current Cost</th>
                <th className="px-5 py-2 font-medium">Status</th>
                <th className="px-5 py-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((product) => (
                <tr key={product.id} className="border-b border-border/60 last:border-0">
                  <td className="px-5 py-3">
                    <p className="font-medium">{product.name}</p>
                    {product.note && (
                      <p className="text-xs text-muted-foreground">{product.note}</p>
                    )}
                  </td>
                  <td className="px-5 py-3">{product.category}</td>
                  <td className="px-5 py-3">
                    <p>{formatUnits(product.unit)}</p>
                    {getProductSaleUnitOptions(product).length > 1 && (
                      <>
                        <p className="text-xs text-muted-foreground">
                          Sell as: {formatProductSaleUnits(product)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {getSaleUnitConversionNote(product)}
                        </p>
                      </>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right font-medium">
                    <p>{getDisplayStockUnitQuantity(product, product.stock)}</p>
                    {getProductSaleSubUnitOptions(product).map((saleSubUnit) => (
                      <p key={saleSubUnit.unit} className="text-xs text-muted-foreground">
                        {getDisplaySubUnitQuantity(product, product.stock, saleSubUnit.unit)}{" "}
                        {saleSubUnit.unit}
                      </p>
                    ))}
                  </td>
                  <td className="px-5 py-3 text-right">{fmtMoney(product.avgCost)}</td>
                  <td className="px-5 py-3">
                    <StockBadge stock={product.stock} min={product.minStock} />
                  </td>
                  <td className="px-5 py-3 text-right whitespace-nowrap">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(product)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        if (confirm(`Delete ${product.name}?`)) {
                          deleteProduct(product.id);
                          toast.success("Product deleted");
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-muted-foreground">
                    No products found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </PageSection>

      <ProductDialog
        open={open}
        onClose={() => setOpen(false)}
        product={editing}
        variantProduct={editingVariantProduct}
        categories={categories}
        onSave={(data) => {
          upsertProduct(data);
          toast.success(editing ? "Product updated" : "Product added");
          setOpen(false);
        }}
        onAddVariant={(variant) => editingVariantProduct && addVariant(editingVariantProduct.id, variant)}
        onRemoveVariant={(variantId) =>
          editingVariantProduct && removeVariant(editingVariantProduct.id, variantId)
        }
      />

      <CategoryManagerDialog
        open={categoryOpen}
        onClose={() => setCategoryOpen(false)}
        categories={categories}
        products={state.products}
        onAddCategory={onAddCategory}
        onUpdateCategory={onUpdateCategory}
        onDeleteCategory={onDeleteCategory}
      />
    </div>
  );
}

function CategoryManagerDialog({
  open,
  onClose,
  categories,
  products,
  onAddCategory,
  onUpdateCategory,
  onDeleteCategory,
}: {
  open: boolean;
  onClose: () => void;
  categories: ProductCategory[];
  products: Product[];
  onAddCategory: (category: ProductCategory) => CategoryMutationResult;
  onUpdateCategory: (currentName: string, category: ProductCategory) => CategoryMutationResult;
  onDeleteCategory: (name: string) => CategoryMutationResult;
}) {
  const [name, setName] = useState("");
  const [defaultUnit, setDefaultUnit] = useState<UnitType>("បេ");
  const [editingName, setEditingName] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [editingUnit, setEditingUnit] = useState<UnitType>("បេ");

  useMemoReset(open, () => {
    if (open) return;
    setName("");
    setDefaultUnit("បេ");
    setEditingName(null);
    setEditingValue("");
    setEditingUnit("បេ");
  });

  const startEdit = (category: ProductCategory) => {
    setEditingName(category.name);
    setEditingValue(category.name);
    setEditingUnit(category.defaultUnit);
  };

  const saveNewCategory = () => {
    const result = onAddCategory({ name, defaultUnit });
    if (!result.ok) return;
    toast.success("Category added");
    setName("");
    setDefaultUnit("បេ");
  };

  const saveEdit = () => {
    if (!editingName) return;
    const result = onUpdateCategory(editingName, { name: editingValue, defaultUnit: editingUnit });
    if (!result.ok) return;
    toast.success("Category updated");
    setEditingName(null);
    setEditingValue("");
    setEditingUnit("បេ");
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Manage Categories</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-lg border border-border p-4 space-y-3">
            <div>
              <Label>Add New Category</Label>
              <p className="text-xs text-muted-foreground mt-1">
                Create your own category and choose a suggested unit for new products. You can still
                change the unit on each product later.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-[1fr_140px_auto] gap-3">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Category name"
              />
              <Select
                value={defaultUnit}
                onValueChange={(value) => setDefaultUnit(value as UnitType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UNITS.map((unit) => (
                    <SelectItem key={unit} value={unit}>
                      {unit}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={saveNewCategory}>
                <Plus className="h-4 w-4 mr-1" />
                Add
              </Button>
            </div>
          </div>

          <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
            {categories.map((category) => {
              const productCount = products.filter((product) =>
                sameCategoryName(product.category, category.name),
              ).length;
              const isEditing = !!editingName && sameCategoryName(editingName, category.name);

              if (isEditing) {
                return (
                  <div
                    key={category.name}
                    className="rounded-lg border border-border p-3 space-y-3"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-[1fr_140px] gap-3">
                      <div>
                        <Label>Name</Label>
                        <Input
                          value={editingValue}
                          onChange={(e) => setEditingValue(e.target.value)}
                        />
                      </div>
                      <div>
                        <Label>Suggested Unit</Label>
                        <Select
                          value={editingUnit}
                          onValueChange={(value) => setEditingUnit(value as UnitType)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {UNITS.map((unit) => (
                              <SelectItem key={unit} value={unit}>
                                {unit}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setEditingName(null)}>
                        Cancel
                      </Button>
                      <Button onClick={saveEdit}>Save</Button>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={category.name}
                  className="rounded-lg border border-border px-4 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium">{category.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Suggested unit: {category.defaultUnit} · {productCount} product(s)
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="ghost" onClick={() => startEdit(category)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        if (!confirm(`Delete category "${category.name}"?`)) return;
                        const result = onDeleteCategory(category.name);
                        if (!result.ok) return;
                        toast.success(
                          productCount > 0
                            ? 'Category deleted. Products moved to "ផ្សេងៗ".'
                            : "Category deleted",
                        );
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ProductDialog({
  open,
  onClose,
  product,
  variantProduct,
  categories,
  onSave,
  onAddVariant,
  onRemoveVariant,
}: {
  open: boolean;
  onClose: () => void;
  product: Product | null;
  variantProduct: Product | null;
  categories: ProductCategory[];
  onSave: (data: {
    id?: string;
    name: string;
    category: string;
    unit: UnitType[];
    saleSubUnits?: ProductSaleSubUnit[];
    minStock: number;
    note?: string;
  }) => void;
  onAddVariant: (variant: Omit<ProductVariant, "id">) => void;
  onRemoveVariant: (id: string) => void;
}) {
  const [name, setName] = useState(product?.name ?? "");
  const [category, setCategory] = useState(product?.category ?? "");
  const [unit, setUnit] = useState<UnitType>(primaryUnit(product?.unit));
  const [minStock, setMinStock] = useState(product?.minStock ?? 0);
  const [note, setNote] = useState(product?.note ?? "");
  const [saleSubUnits, setSaleSubUnits] = useState<ProductSaleSubUnit[]>(
    getInitialSaleSubUnits(product),
  );
  const [vSize, setVSize] = useState("");
  const [vColor, setVColor] = useState("");
  const [vType, setVType] = useState("");
  const recommendedSaleUnits = useMemo(
    () => getRecommendedSaleUnitConfigs(category, unit, name),
    [category, name, unit],
  );
  const remainingSuggestedSaleUnits = useMemo(
    () =>
      recommendedSaleUnits.filter(
        (suggestedUnit) =>
          !saleSubUnits.some((saleSubUnit) => saleSubUnit.unit === suggestedUnit.unit),
      ),
    [recommendedSaleUnits, saleSubUnits],
  );
  const canAddSaleUnit = saleSubUnits.length < UNITS.filter((item) => item !== unit).length;

  useEffect(() => {
    if (!open) return;

    const nextCategory = product?.category ?? "";

    setName(product?.name ?? "");
    setCategory(nextCategory);
    setUnit(product ? primaryUnit(product.unit) : getCategoryDefaultUnit(categories, nextCategory));
    setMinStock(product?.minStock ?? 0);
    setNote(product?.note ?? "");
    setSaleSubUnits(getInitialSaleSubUnits(product));
    setVSize("");
    setVColor("");
    setVType("");
  }, [categories, open, product]);

  const updateStockUnit = (nextUnit: UnitType) => {
    setUnit(nextUnit);
    setSaleSubUnits((currentSaleSubUnits) => sanitizeSaleSubUnits(currentSaleSubUnits, nextUnit));
  };

  const onCategoryChange = (value: string) => {
    setCategory(value);
    updateStockUnit(getCategoryDefaultUnit(categories, value));
  };

  const addSaleSubUnit = (suggestion?: SuggestedSaleUnitConfig) => {
    setSaleSubUnits((currentSaleSubUnits) => {
      const availableUnits = UNITS.filter(
        (item) =>
          item !== unit && !currentSaleSubUnits.some((saleSubUnit) => saleSubUnit.unit === item),
      );
      if (availableUnits.length === 0) return currentSaleSubUnits;

      const preferredSuggestion =
        suggestion ??
        recommendedSaleUnits.find((recommendedSaleUnit) =>
          availableUnits.includes(recommendedSaleUnit.unit),
        );
      const nextUnit = preferredSuggestion?.unit ?? availableUnits[0];

      return [
        ...currentSaleSubUnits,
        {
          unit: nextUnit,
          quantityPerStockUnit: preferredSuggestion?.suggestedQuantityPerStockUnit ?? 0,
        },
      ];
    });
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{product ? "Edit Product" : "New Product"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={category} onValueChange={onCategoryChange}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((item) => (
                    <SelectItem key={item.name} value={item.name}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Unit</Label>
              <Select value={unit} onValueChange={(value) => updateStockUnit(value as UnitType)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UNITS.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div className="space-y-1">
                <Label>Optional Sale Units</Label>
                {recommendedSaleUnits.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Suggested for this setup:{" "}
                    {recommendedSaleUnits
                      .map((saleUnit, index) => {
                        const parentUnit =
                          index === 0 ? unit : recommendedSaleUnits[index - 1]?.unit ?? unit;
                        return (
                        saleUnit.suggestedQuantityPerStockUnit
                          ? `1 ${parentUnit} = ${saleUnit.suggestedQuantityPerStockUnit} ${saleUnit.unit}`
                          : `1 ${parentUnit} = ... ${saleUnit.unit}`
                        );
                      })
                      .join(" · ")}
                  </p>
                )}
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="self-start"
                onClick={() => addSaleSubUnit()}
                disabled={!canAddSaleUnit}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Optional Unit
              </Button>
            </div>

            {remainingSuggestedSaleUnits.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {remainingSuggestedSaleUnits.map((saleUnit) => (
                  <Button
                    key={saleUnit.unit}
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-8 px-3"
                    onClick={() => addSaleSubUnit(saleUnit)}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    {saleUnit.unit}
                  </Button>
                ))}
              </div>
            )}

            {saleSubUnits.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No optional sale units yet. Add one above only if this product also sells in a
                smaller unit.
              </p>
            ) : (
              <div className="space-y-3">
                {saleSubUnits.map((saleSubUnit, index) => {
                  const parentUnit = getSaleSubUnitParentLabel(unit, saleSubUnits, index);

                  return (
                  <div
                    key={`${saleSubUnit.unit}-${index}`}
                    className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,220px)_minmax(0,1fr)_auto] md:gap-4 md:items-start"
                  >
                    <div className="space-y-2">
                      <Label>Sub-Unit</Label>
                      <Select
                        value={saleSubUnit.unit}
                        onValueChange={(value) =>
                          setSaleSubUnits((currentSaleSubUnits) =>
                            currentSaleSubUnits.map((currentSaleSubUnit, rowIndex) =>
                              rowIndex === index
                                ? { ...currentSaleSubUnit, unit: value as UnitType }
                                : currentSaleSubUnit,
                            ),
                          )
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {UNITS.filter(
                            (item) =>
                              item !== unit &&
                              (item === saleSubUnit.unit ||
                                !saleSubUnits.some(
                                  (currentSaleSubUnit, rowIndex) =>
                                    rowIndex !== index && currentSaleSubUnit.unit === item,
                                )),
                          ).map((item) => (
                            <SelectItem key={item} value={item}>
                              {item}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Quantity Per {parentUnit}</Label>
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={displayZeroAsPlaceholder(saleSubUnit.quantityPerStockUnit)}
                        placeholder="0"
                        onChange={(e) => {
                          const normalizedValue = normalizeLocalizedDigits(e.target.value);
                          if (
                            normalizedValue !== "" &&
                            !/^\d+(?:\.\d*)?$/.test(normalizedValue)
                          ) {
                            return;
                          }

                          setSaleSubUnits((currentSaleSubUnits) =>
                            currentSaleSubUnits.map((currentSaleSubUnit, rowIndex) =>
                              rowIndex === index
                                ? {
                                    ...currentSaleSubUnit,
                                    quantityPerStockUnit: parseNumericInput(normalizedValue),
                                  }
                                : currentSaleSubUnit,
                            ),
                          );
                        }}
                      />
                      <p className="text-xs text-muted-foreground">
                        {saleSubUnit.quantityPerStockUnit > 0
                          ? `1 ${parentUnit} = ${saleSubUnit.quantityPerStockUnit} ${saleSubUnit.unit}.`
                          : `Set how many ${saleSubUnit.unit} fit inside 1 ${parentUnit}.`}
                      </p>
                    </div>

                    <div className="flex md:pt-8">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="self-start"
                        onClick={() =>
                          setSaleSubUnits((currentSaleSubUnits) =>
                            currentSaleSubUnits.filter((_, rowIndex) => rowIndex !== index),
                          )
                        }
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <Label>Minimum Stock Alert</Label>
            <Input
              type="number"
              value={displayZeroAsPlaceholder(minStock)}
              placeholder="0"
              onChange={(e) => setMinStock(parseNumericInput(e.target.value))}
            />
          </div>
          <div>
            <Label>Note</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
          </div>

          {variantProduct && (
            <div className="border-t border-border pt-3">
              <Label className="mb-2 block">Variants</Label>
              <div className="space-y-2 mb-3">
                {variantProduct.variants.length === 0 && (
                  <p className="text-xs text-muted-foreground">No variants yet.</p>
                )}
                {variantProduct.variants.map((variant) => (
                  <div
                    key={variant.id}
                    className="flex items-center gap-2 text-sm bg-muted px-3 py-1.5 rounded"
                  >
                    <span className="flex-1">
                      {[variant.size, variant.color, variant.type].filter(Boolean).join(" / ") ||
                        "(empty)"}
                    </span>
                    <button
                      type="button"
                      onClick={() => onRemoveVariant(variant.id)}
                      className="text-destructive"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Input
                  placeholder="Size"
                  value={vSize}
                  onChange={(e) => setVSize(e.target.value)}
                />
                <Input
                  placeholder="Color"
                  value={vColor}
                  onChange={(e) => setVColor(e.target.value)}
                />
                <Input
                  placeholder="Type"
                  value={vType}
                  onChange={(e) => setVType(e.target.value)}
                />
              </div>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="mt-2"
                onClick={() => {
                  if (!vSize && !vColor && !vType) {
                    toast.error("Enter at least one field");
                    return;
                  }
                  onAddVariant({
                    size: vSize || undefined,
                    color: vColor || undefined,
                    type: vType || undefined,
                  });
                  setVSize("");
                  setVColor("");
                  setVType("");
                }}
              >
                <Plus className="h-3 w-3 mr-1" />
                Add Variant
              </Button>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              if (!name.trim() || !category.trim()) {
                toast.error("Name and category required");
                return;
              }
              if (!unit) {
                toast.error("Choose one unit");
                return;
              }
              const configuredSaleSubUnits = saleSubUnits.filter(
                (saleSubUnit) => saleSubUnit.quantityPerStockUnit > 0,
              );
              const uniqueUnits = new Set<UnitType>();
              for (const saleSubUnit of configuredSaleSubUnits) {
                if (saleSubUnit.unit === unit) {
                  toast.error("Optional sale unit must be different from stock unit");
                  return;
                }
                if (uniqueUnits.has(saleSubUnit.unit)) {
                  toast.error("Each optional sale unit can only be added once");
                  return;
                }
                uniqueUnits.add(saleSubUnit.unit);
              }

              onSave({
                id: product?.id,
                name: name.trim(),
                category: category.trim(),
                unit: [unit],
                saleSubUnits:
                  configuredSaleSubUnits.length > 0
                    ? sanitizeSaleSubUnits(configuredSaleSubUnits, unit)
                    : undefined,
                minStock,
                note: note.trim() || undefined,
              });
            }}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function useMemoReset<T>(dep: T, fn: () => void) {
  useEffect(fn, [dep]); // eslint-disable-line react-hooks/exhaustive-deps
}
