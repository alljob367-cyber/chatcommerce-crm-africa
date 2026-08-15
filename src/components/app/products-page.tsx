"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useAppStore } from "@/store/app";
import Header from "./header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Package,
  Plus,
  Search,
  Edit2,
  Trash2,
  PackageCheck,
  Tag,
  Upload,
  X,
  Image as ImageIcon,
  Camera,
  Eye,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  FileImage,
} from "lucide-react";
import { formatCurrency } from "@/lib/currencies";
import { toast } from "sonner";

interface Category { id: string; name: string; _count: { products: number } }
interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  compareAtPrice?: number | null;
  sku: string;
  stock: number;
  image?: string;
  images?: string;
  isActive: boolean;
  category?: { id: string; name: string } | null;
}

export default function ProductsPage() {
  const { token } = useAppStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [showCat, setShowCat] = useState(false);
  const [newCat, setNewCat] = useState("");
  const [form, setForm] = useState({ name: "", description: "", price: "", sku: "", stock: "", categoryId: "" });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formImages, setFormImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [viewProduct, setViewProduct] = useState<Product | null>(null);
  const [galleryIdx, setGalleryIdx] = useState(0);
  const [uploadTarget, setUploadTarget] = useState<"form" | "product" | null>(null);
  const [uploadProductId, setUploadProductId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [processingFiles, setProcessingFiles] = useState(false);

  const fetchData = useCallback(() => {
    if (!token) return;
    const params = search ? `?search=${search}` : "";
    Promise.all([
      fetch(`/api/products${params}`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
      fetch("/api/products/categories", { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
    ])
      .then(([pd, cd]) => {
        setProducts(pd.products || []);
        setCategories(cd.categories || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token, search]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Parse images JSON from product
  const getProductImages = (p: Product): string[] => {
    if (p.images) {
      try { return JSON.parse(p.images); } catch { return []; }
    }
    return p.image ? [p.image] : [];
  };

  // Convert file to base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Handle file selection (click or drag)
  const handleFiles = async (files: FileList | File[]) => {
    if (!token || !files.length) return;
    setProcessingFiles(true);

    try {
      const validFiles = Array.from(files).filter((f) => {
        if (f.size > 5 * 1024 * 1024) {
          toast.error(`"${f.name}" est trop volumineux (max 5 MB)`);
          return false;
        }
        if (!f.type.startsWith("image/")) {
          toast.error(`"${f.name}" n'est pas une image`);
          return false;
        }
        return true;
      });

      if (!validFiles.length) { setProcessingFiles(false); return; }

      const base64Array = await Promise.all(validFiles.map(fileToBase64));

      if (uploadTarget === "product" && uploadProductId) {
        // Upload to existing product
        const res = await fetch("/api/products/upload", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ productId: uploadProductId, images: base64Array }),
        });
        if (res.ok) {
          fetchData();
        } else {
          const err = await res.json();
          toast.error(err.error || "Erreur upload");
        }
      } else {
        // Add to form images
        setFormImages((prev) => [...prev, ...base64Array].slice(0, 10));
      }
    } catch {
      toast.error("Erreur lors du traitement des fichiers");
    } finally {
      setProcessingFiles(false);
      setDragOver(false);
    }
  };

  // Remove image from form
  const removeFormImage = (idx: number) => {
    setFormImages((prev) => prev.filter((_, i) => i !== idx));
  };

  // Set image as main (first in form)
  const setFormImageAsMain = (idx: number) => {
    setFormImages((prev) => {
      const copy = [...prev];
      const [img] = copy.splice(idx, 1);
      return [img, ...copy];
    });
  };

  // Upload image to existing product
  const handleUploadToProduct = (p: Product) => {
    setUploadTarget("product");
    setUploadProductId(p.id);
    fileInputRef.current?.click();
  };

  // Delete image from existing product
  const handleDeleteImage = async (p: Product, imageUrl: string) => {
    if (!token) return;
    const res = await fetch("/api/products/upload", {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ productId: p.id, imageUrl }),
    });
    if (res.ok) fetchData();
  };

  // Drag & drop handlers
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setDragOver(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setDragOver(false); };
  const handleDrop = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); handleFiles(e.dataTransfer.files); };

  const handleAddProduct = async () => {
    if (!token || !form.name || !form.price) return;
    setUploading(true);
    try {
      const mainImage = formImages.length > 0 ? formImages[0] : undefined;
      const payload = {
        ...form,
        price: parseFloat(form.price),
        stock: parseInt(form.stock) || 0,
        image: mainImage,
        images: formImages.length > 0 ? formImages : undefined,
      };

      if (editingId) {
        const res = await fetch("/api/products", {
          method: "PATCH",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ id: editingId, ...payload }),
        });
        if (!res.ok) { toast.error("Erreur lors de la modification"); return; }
        setEditingId(null);
      } else {
        const res = await fetch("/api/products", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) { toast.error("Erreur lors de l'ajout"); return; }
      }
      setShowAdd(false);
      setForm({ name: "", description: "", price: "", sku: "", stock: "", categoryId: "" });
      setFormImages([]);
      fetchData();
    } finally {
      setUploading(false);
    }
  };

  const handleAddCat = async () => {
    if (!token || !newCat) return;
    await fetch("/api/products/categories", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name: newCat }),
    });
    setShowCat(false);
    setNewCat("");
    fetchData();
  };

  const handleEditProduct = (p: Product) => {
    setEditingId(p.id);
    setForm({
      name: p.name,
      description: p.description || "",
      price: String(p.price),
      sku: p.sku,
      stock: String(p.stock),
      categoryId: p.category?.id || "",
    });
    setFormImages(getProductImages(p));
    setShowAdd(true);
  };

  const handleDeleteProduct = async (id: string) => {
    if (!confirm("Supprimer ce produit ?")) return;
    if (!token) return;
    const res = await fetch(`/api/products?id=${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      fetchData();
    } else {
      toast.error("Erreur lors de la suppression");
    }
  };

  const formatXAF = (n: number) => formatCurrency(n, "XAF");

  // Open gallery viewer
  const openGallery = (p: Product) => {
    setViewProduct(p);
    setGalleryIdx(0);
  };

  return (
    <>
      <Header title="Produits" subtitle={`${products.length} produits au catalogue`}>
        <Dialog open={showCat} onOpenChange={setShowCat}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm"><Tag className="w-4 h-4 mr-1" />Catégorie</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nouvelle catégorie</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Nom</Label><Input placeholder="Ex: Boissons" value={newCat} onChange={(e) => setNewCat(e.target.value)} /></div>
              <Button className="w-full bg-primary" onClick={handleAddCat}>Créer</Button>
            </div>
          </DialogContent>
        </Dialog>
        <Dialog open={showAdd} onOpenChange={(open) => { setShowAdd(open); if (!open) { setFormImages([]); setEditingId(null); } }}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90"><Plus className="w-4 h-4 mr-1" />Produit</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editingId ? "Modifier le produit" : "Nouveau produit"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Nom *</Label><Input placeholder="Poulet DG" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label>Description</Label><Textarea placeholder="Description du produit..." value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Prix (FCFA) *</Label><Input type="number" placeholder="4500" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></div>
                <div><Label>Stock</Label><Input type="number" placeholder="50" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} /></div>
              </div>
              <div><Label>Catégorie</Label>
                <Select value={form.categoryId} onValueChange={(v) => setForm({ ...form, categoryId: v })}>
                  <SelectTrigger><SelectValue placeholder="Choisir..." /></SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* ===== PHOTO / FLYER / VISUEL UPLOAD ===== */}
              <div>
                <Label className="flex items-center gap-2 mb-2">
                  <Camera className="w-4 h-4" />
                  Photos / Flyers / Visuels
                  <span className="text-xs text-muted-foreground">(max 10, 5 MB chacune)</span>
                </Label>

                {/* Upload zone drag & drop */}
                <div
                  className={`relative border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer ${
                    dragOver
                      ? "border-primary bg-primary/5 scale-[1.01]"
                      : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30"
                  }`}
                  onClick={() => { setUploadTarget("form"); fileInputRef.current?.click(); }}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => { if (e.target.files) handleFiles(e.target.files); e.target.value = ""; }}
                  />
                  <div className="flex flex-col items-center gap-2">
                    {processingFiles ? (
                      <>
                        <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        <p className="text-sm text-muted-foreground">Traitement en cours...</p>
                      </>
                    ) : (
                      <>
                        <Upload className="w-10 h-10 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">Cliquez ou glissez vos images ici</p>
                          <p className="text-xs text-muted-foreground mt-1">JPG, PNG, GIF, WebP, SVG — Photo produit, Flyer, Visuel promo</p>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Form images preview grid */}
                {formImages.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs text-muted-foreground mb-2">
                      {formImages.length} image(s) — La première est l'image principale
                    </p>
                    <div className="grid grid-cols-4 gap-2">
                      {formImages.map((img, idx) => (
                        <div key={idx} className="relative group rounded-lg overflow-hidden border border-muted aspect-square">
                          <img src={img} alt={`Preview ${idx + 1}`} className="w-full h-full object-cover" />
                          {/* Main image badge */}
                          {idx === 0 && (
                            <div className="absolute top-0.5 left-0.5 bg-primary text-primary-foreground text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                              PRINCIPALE
                            </div>
                          )}
                          {/* Action buttons */}
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                            {idx !== 0 && (
                              <button
                                className="p-1 bg-white rounded-full hover:bg-primary hover:text-primary-foreground transition-colors"
                                title="Définir comme principale"
                                onClick={(e) => { e.stopPropagation(); setFormImageAsMain(idx); }}
                              >
                                <ZoomIn className="w-3 h-3" />
                              </button>
                            )}
                            <button
                              className="p-1 bg-white rounded-full hover:bg-red-500 hover:text-white transition-colors"
                              title="Supprimer"
                              onClick={(e) => { e.stopPropagation(); removeFormImage(idx); }}
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <Button
                className="w-full bg-primary"
                onClick={handleAddProduct}
                disabled={uploading || processingFiles}
              >
                {uploading ? "Enregistrement..." : editingId ? "Modifier" : "Ajouter"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </Header>

      <div className="p-6 animate-fade-in">
        <div className="relative max-w-sm mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Rechercher un produit..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>

        {/* Categories */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {categories.map((c) => (
            <Badge key={c.id} variant="outline" className="text-xs py-1.5 px-3">
              {c.name} <span className="ml-1 text-muted-foreground">({c._count.products})</span>
            </Badge>
          ))}
        </div>

        {/* Products Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {loading
            ? Array.from({ length: 8 }).map((_, i) => (
                <Card key={i} className="border-0 shadow-sm"><CardContent className="p-4 h-44 animate-pulse bg-muted rounded-xl" /></Card>
              ))
            : products.map((p) => {
                const pImages = getProductImages(p);
                const hasGallery = pImages.length > 1;

                return (
                  <Card key={p.id} className="border-0 shadow-sm hover:shadow-md transition-shadow group">
                    <CardContent className="p-4">
                      {/* Product image with gallery indicator */}
                      <div
                        className={`w-full bg-gradient-to-br from-muted to-muted/60 rounded-lg mb-3 flex items-center justify-center relative ${
                          hasGallery ? "h-32 cursor-pointer" : "h-28"
                        }`}
                        onClick={() => hasGallery && openGallery(p)}
                      >
                        {pImages.length > 0 ? (
                          <>
                            <img
                              src={pImages[0]}
                              alt={p.name}
                              className="w-full h-full object-cover rounded-lg"
                            />
                            {/* Gallery dots indicator */}
                            {hasGallery && (
                              <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 flex gap-1">
                                {pImages.map((_, idx) => (
                                  <div
                                    key={idx}
                                    className={`w-1.5 h-1.5 rounded-full ${
                                      idx === 0 ? "bg-white" : "bg-white/50"
                                    }`}
                                  />
                                ))}
                              </div>
                            )}
                            {/* Photo count badge */}
                            {pImages.length > 1 && (
                              <div className="absolute top-1.5 right-1.5 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                                <ImageIcon className="w-2.5 h-2.5" />
                                {pImages.length}
                              </div>
                            )}
                          </>
                        ) : (
                          <Package className="w-8 h-8 text-muted-foreground" />
                        )}
                      </div>

                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm text-foreground truncate">{p.name}</p>
                          {p.category && (
                            <p className="text-[11px] text-muted-foreground">{p.category.name}</p>
                          )}
                        </div>
                        <div className="flex gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEditProduct(p)} title="Modifier"><Edit2 className="w-3 h-3" /></Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleUploadToProduct(p)} title="Ajouter photo"><Upload className="w-3 h-3" /></Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400" onClick={() => handleDeleteProduct(p.id)} title="Supprimer"><Trash2 className="w-3 h-3" /></Button>
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <p className="text-base font-bold text-[#25D366]">{formatXAF(p.price)}</p>
                        <div className="flex items-center gap-1">
                          <PackageCheck className="w-3 h-3 text-muted-foreground" />
                          <span className={`text-xs font-medium ${p.stock > 10 ? "text-foreground" : "text-red-500"}`}>
                            {p.stock} en stock
                          </span>
                        </div>
                      </div>
                      <div className="mt-1.5 text-[10px] text-muted-foreground">{p.sku}</div>
                    </CardContent>
                  </Card>
                );
              })}
        </div>
      </div>

      {/* ===== GALLERY VIEWER DIALOG ===== */}
      <Dialog open={!!viewProduct} onOpenChange={(open) => { if (!open) setViewProduct(null); }}>
        <DialogContent className="max-w-2xl p-0 gap-0 overflow-hidden bg-black/95 border-white/10">
          {viewProduct && (() => {
            const imgs = getProductImages(viewProduct);
            const currentImg = imgs[galleryIdx] || imgs[0];

            return (
              <div className="flex flex-col">
                {/* Main image */}
                <div className="relative w-full aspect-square max-h-[70vh] bg-black flex items-center justify-center">
                  {currentImg ? (
                    <img src={currentImg} alt={viewProduct.name} className="max-w-full max-h-full object-contain" />
                  ) : (
                    <Package className="w-16 h-16 text-white/30" />
                  )}

                  {/* Nav arrows */}
                  {imgs.length > 1 && (
                    <>
                      <button
                        className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors"
                        onClick={() => setGalleryIdx((i) => (i - 1 + imgs.length) % imgs.length)}
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                      <button
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors"
                        onClick={() => setGalleryIdx((i) => (i + 1) % imgs.length)}
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </>
                  )}

                  {/* Delete image button */}
                  <button
                    className="absolute top-2 right-2 p-2 bg-red-500/80 hover:bg-red-600 rounded-full text-white transition-colors"
                    onClick={async () => {
                      await handleDeleteImage(viewProduct, currentImg);
                      const remaining = imgs.filter((img) => img !== currentImg);
                      if (remaining.length === 0) {
                        setViewProduct(null);
                      } else {
                        setGalleryIdx(Math.min(galleryIdx, remaining.length - 1));
                        // Refresh product data in viewProduct state
                        setViewProduct({ ...viewProduct, images: JSON.stringify(remaining), image: remaining[0] || undefined });
                      }
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  {/* Image counter */}
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/60 text-white text-xs px-3 py-1 rounded-full">
                    {galleryIdx + 1} / {imgs.length}
                  </div>
                </div>

                {/* Thumbnail strip */}
                {imgs.length > 1 && (
                  <div className="flex gap-2 p-3 overflow-x-auto bg-black/50">
                    {imgs.map((img, idx) => (
                      <button
                        key={idx}
                        className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                          idx === galleryIdx ? "border-primary scale-105" : "border-transparent opacity-60 hover:opacity-100"
                        }`}
                        onClick={() => setGalleryIdx(idx)}
                      >
                        <img src={img} alt={`Miniature ${idx + 1}`} className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}

                {/* Product info footer */}
                <div className="p-4 bg-black/80 border-t border-white/10">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-white font-semibold">{viewProduct.name}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-[#25D366] font-bold">{formatXAF(viewProduct.price)}</span>
                        {viewProduct.category && (
                          <span className="text-white/50 text-sm">{viewProduct.category.name}</span>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-white/20 text-white hover:bg-white/10"
                      onClick={() => {
                        setViewProduct(null);
                        handleUploadToProduct(viewProduct);
                      }}
                    >
                      <Upload className="w-4 h-4 mr-1" />
                      Ajouter photo
                    </Button>
                  </div>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </>
  );
}
