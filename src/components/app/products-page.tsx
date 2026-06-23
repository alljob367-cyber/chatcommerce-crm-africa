"use client";

import { useEffect, useState, useCallback } from "react";
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
} from "lucide-react";

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
  isActive: boolean;
  category?: { name: string } | null;
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
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [token, search]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAddProduct = async () => {
    if (!token || !form.name || !form.price) return;
    await fetch("/api/products", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, price: parseFloat(form.price), stock: parseInt(form.stock) || 0 }),
    });
    setShowAdd(false);
    setForm({ name: "", description: "", price: "", sku: "", stock: "", categoryId: "" });
    fetchData();
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

  const formatXAF = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.round(n)) + " FCFA";

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
              <Button className="w-full bg-[#0F172A]" onClick={handleAddCat}>Créer</Button>
            </div>
          </DialogContent>
        </Dialog>
        <Dialog open={showAdd} onOpenChange={setShowAdd}>
          <DialogTrigger asChild>
            <Button className="bg-[#0F172A] hover:bg-[#1e293b]"><Plus className="w-4 h-4 mr-1" />Produit</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nouveau produit</DialogTitle></DialogHeader>
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
              <Button className="w-full bg-[#0F172A]" onClick={handleAddProduct}>Ajouter</Button>
            </div>
          </DialogContent>
        </Dialog>
      </Header>

      <div className="p-6 animate-fade-in">
        <div className="relative max-w-sm mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input placeholder="Rechercher un produit..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>

        {/* Categories */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {categories.map((c) => (
            <Badge key={c.id} variant="outline" className="text-xs py-1.5 px-3">
              {c.name} <span className="ml-1 text-gray-400">({c._count.products})</span>
            </Badge>
          ))}
        </div>

        {/* Products Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {loading
            ? Array.from({ length: 8 }).map((_, i) => (
                <Card key={i} className="border-0 shadow-sm"><CardContent className="p-4 h-44 animate-pulse bg-gray-100 rounded-xl" /></Card>
              ))
            : products.map((p) => (
                <Card key={p.id} className="border-0 shadow-sm hover:shadow-md transition-shadow group">
                  <CardContent className="p-4">
                    <div className="w-full h-28 bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg mb-3 flex items-center justify-center">
                      {p.image ? (
                        <img src={p.image} alt={p.name} className="w-full h-full object-cover rounded-lg" />
                      ) : (
                        <Package className="w-8 h-8 text-gray-300" />
                      )}
                    </div>
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-[#0F172A] truncate">{p.name}</p>
                        {p.category && (
                          <p className="text-[11px] text-gray-400">{p.category.name}</p>
                        )}
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" className="h-7 w-7"><Edit2 className="w-3 h-3" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400"><Trash2 className="w-3 h-3" /></Button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <p className="text-base font-bold text-[#25D366]">{formatXAF(p.price)}</p>
                      <div className="flex items-center gap-1">
                        <PackageCheck className="w-3 h-3 text-gray-400" />
                        <span className={`text-xs font-medium ${p.stock > 10 ? "text-gray-600" : "text-red-500"}`}>
                          {p.stock} en stock
                        </span>
                      </div>
                    </div>
                    <div className="mt-1.5 text-[10px] text-gray-400">{p.sku}</div>
                  </CardContent>
                </Card>
              ))}
        </div>
      </div>
    </>
  );
}