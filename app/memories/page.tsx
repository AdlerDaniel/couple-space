"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

type Memory = {
  id: string;
  text: string;
  created_at: string;
  image: string | null;
};

export default function MemoriesPage() {
  const router = useRouter();
  const [memoryText, setMemoryText] = useState("");
  const [memoryImage, setMemoryImage] = useState<string | null>(null);
  const [memoryImageFile, setMemoryImageFile] = useState<File | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [coupleId, setCoupleId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function checkUser() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) router.push("/login");
    }
    checkUser();
  }, [router]);

  useEffect(() => {
    async function loadCoupleAndMemories() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

      const { data: coupleData, error: coupleError } = await supabase
        .from("couples")
        .select("*")
        .or(`partner_one_id.eq.${user.id},partner_two_id.eq.${user.id}`)
        .limit(1)
        .single();

      if (coupleError || !coupleData) { router.push("/couple"); return; }
      setCoupleId(coupleData.id);

      const { data: memoriesData, error: memoriesError } = await supabase
        .from("memories")
        .select("*")
        .eq("couple_id", coupleData.id)
        .order("created_at", { ascending: false });

      if (memoriesError) {
        console.error("Ошибка загрузки воспоминаний:", memoriesError);
      } else if (memoriesData) {
        setMemories(memoriesData);
      }

      setIsLoading(false);
    }
    loadCoupleAndMemories();
  }, [router]);

  function compressImage(file: File): Promise<File> {
    return new Promise((resolve, reject) => {
      const image = new Image();
      const reader = new FileReader();

      reader.onload = () => { image.src = reader.result as string; };
      image.onload = () => {
        const canvas = document.createElement("canvas");
        const maxWidth = 1600;
        const scale = Math.min(1, maxWidth / image.width);
        canvas.width = image.width * scale;
        canvas.height = image.height * scale;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas не поддерживается"));
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(blob => {
          if (!blob) return reject(new Error("Не удалось сжать изображение"));
          resolve(new File([blob], `${crypto.randomUUID()}.webp`, { type: "image/webp" }));
        }, "image/webp", 0.8);
      };
      reader.onerror = reject;
      image.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const compressedFile = await compressImage(file);
    setMemoryImageFile(compressedFile);
    const reader = new FileReader();
    reader.onloadend = () => setMemoryImage(reader.result as string);
    reader.readAsDataURL(compressedFile);
  }

  async function addMemory() {
    if (!memoryText.trim() && !memoryImage) return;
    if (!coupleId) { alert("Сначала нужно создать пару"); return; }

    let imageUrl = null;
    if (memoryImageFile) {
      const filePath = `${crypto.randomUUID()}.webp`;
      const { error: uploadError } = await supabase.storage
        .from("memory-images")
        .upload(filePath, memoryImageFile);
      if (uploadError) return console.error("Ошибка загрузки фото:", uploadError);

      const { data: publicUrlData } = supabase.storage
        .from("memory-images")
        .getPublicUrl(filePath);
      imageUrl = publicUrlData.publicUrl;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return alert("Сначала нужно войти в аккаунт");

    const { data, error } = await supabase
      .from("memories")
      .insert([{ text: memoryText, image: imageUrl, user_id: user.id, couple_id: coupleId }])
      .select()
      .single();

    if (error) return console.error("Ошибка загрузки воспоминаний:", error);
    if (data) setMemories([data, ...memories]);
    setMemoryText(""); setMemoryImage(null); setMemoryImageFile(null);
  }

  async function deleteMemory(idToDelete: string) {
    const { error } = await supabase.from("memories").delete().eq("id", idToDelete);
    if (error) return console.error("Ошибка удаления воспоминания:", error);
    setMemories(memories.filter(mem => mem.id !== idToDelete));
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#e2f0ff] to-[#f0f7ff] dark:from-[#001923] dark:to-[#000e13] transition-colors px-6 pb-10 pt-28 text-[#1a73e8] flex flex-col items-center">
      <h1 className="mb-8 text-5xl font-bold text-center text-[#1a73e8]">
        📸 Воспоминания
      </h1>

      {/* Главное окно */}
      <div className="w-full max-w-3xl rounded-3xl p-6 shadow-2xl bg-gradient-to-b from-[#c5dcf0] to-[#d0e6f5] dark:from-[#0f2b40] dark:to-[#0b2235] flex flex-col space-y-6">

        {/* Форма добавления */}
        <div className="rounded-3xl p-6 bg-white/20 dark:bg-white/5 shadow-inner">
          <h2 className="mb-4 text-2xl font-bold text-[#1a73e8]">Добавить воспоминание</h2>
          <textarea
            value={memoryText}
            onChange={(e) => setMemoryText(e.target.value)}
            placeholder="Например: Наша первая поездка в горы ❤️"
            className="mb-4 min-h-[120px] w-full rounded-2xl border border-[#1a73e8] p-4 text-[#1a73e8] outline-none placeholder:text-[#60a0e0]"
          />

          <div className="mb-4">
            <label className="mb-2 block text-sm font-semibold text-[#1a73e8]">
              Фото воспоминания
            </label>
            <label className="block cursor-pointer">
              {memoryImage ? (
                <div className="overflow-hidden rounded-2xl border border-[#1a73e8] bg-[#e2f0ff]/40 shadow dark:bg-[#ffffff0d]">
                  <div className="flex justify-center pt-4">
                    <img src={memoryImage} alt="Preview" className="h-32 w-32 rounded-2xl object-cover shadow-lg" />
                  </div>
                  <div className="p-3 text-center">
                    <p className="font-semibold text-[#1a73e8]">Фото выбрано ❤️</p>
                    <p className="mt-1 text-sm text-[#1a73e8]/70">Нажмите, чтобы выбрать другое</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center rounded-2xl border border-dashed border-[#1a73e8] bg-[#e2f0ff]/40 p-6 text-center transition hover:bg-[#c5dcf0]/50 dark:bg-[#ffffff0d] dark:hover:bg-[#ffffff14]">
                  <div>
                    <p className="text-lg font-semibold text-[#1a73e8]">📸 Выбрать фото</p>
                    <p className="mt-1 text-sm text-[#1a73e8]/70">JPG, PNG или другое изображение</p>
                  </div>
                </div>
              )}
              <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
            </label>
          </div>

          <button
            onClick={addMemory}
            className="mt-2 rounded-full bg-[#1a73e8] px-6 py-3 font-semibold text-white transition hover:bg-[#2380e0]"
          >
            Сохранить
          </button>
        </div>

        {/* Список воспоминаний */}
        {memories.length === 0 ? (
          <div className="rounded-3xl p-8 text-center bg-white/20 dark:bg-white/5 shadow-inner">
            <div className="mb-4 text-5xl">📸</div>
            <h2 className="mb-2 text-2xl font-bold text-[#1a73e8]">Воспоминаний пока нет</h2>
            <p className="text-[#1a73e8]/70">
              Добавьте первое фото или заметку, чтобы начать вашу общую историю.
            </p>
          </div>
        ) : (
          <div className="columns-1 gap-4 space-y-4 md:columns-2">
            {memories.map(memory => (
              <div key={memory.id} className="mb-4 break-inside-avoid rounded-3xl p-6 shadow-lg transition hover:-translate-y-1 hover:shadow-2xl bg-white/20 dark:bg-white/5">
                <div className="flex flex-col items-start">
                  {memory.image && (
                    <img
                      src={memory.image}
                      alt="Фото воспоминания"
                      loading="lazy"
                      onClick={() => setSelectedImage(memory.image)}
                      className="mb-4 h-auto w-full cursor-pointer rounded-2xl object-cover transition hover:opacity-90"
                    />
                  )}
                  {memory.text && <p className="mb-2 text-lg text-[#1a73e8]">{memory.text}</p>}
                  <p className="text-sm text-[#1a73e8]/70">{new Date(memory.created_at).toLocaleDateString()}</p>
                  <button
                    onClick={() => deleteMemory(memory.id)}
                    className="mt-2 rounded-full bg-[#1a73e8]/20 px-4 py-2 text-sm font-semibold text-[#1a73e8] transition hover:bg-[#1a73e8]/30"
                  >
                    🗑 Удалить
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Модальное окно для увеличенного фото */}
      {selectedImage && (
        <div
          onClick={() => setSelectedImage(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
        >
          <button
            onClick={() => setSelectedImage(null)}
            className="absolute right-6 top-6 rounded-full bg-white px-4 py-2 font-bold text-gray-800"
          >
            ✕
          </button>
          <img
            src={selectedImage}
            alt="Увеличенное фото"
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90vh] max-w-full rounded-2xl object-contain"
          />
        </div>
      )}
    </main>
  );
}