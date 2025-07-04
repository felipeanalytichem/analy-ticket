import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Tag, 
  Plus, 
  X, 
  Search,
  Filter,
  Hash
} from "lucide-react";

interface TagItem {
  id: string;
  name: string;
  color: string;
  category: string;
  count: number;
}

interface TicketTagsProps {
  ticketId?: string;
  selectedTags?: string[];
  onTagsChange?: (tags: string[]) => void;
  mode?: "edit" | "filter" | "display";
}

export const TicketTags = ({ 
  ticketId, 
  selectedTags = [], 
  onTagsChange,
  mode = "edit" 
}: TicketTagsProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [newTagName, setNewTagName] = useState("");
  const [showCreateTag, setShowCreateTag] = useState(false);

  // Tags predefinidas
  const predefinedTags: TagItem[] = [
    { id: "1", name: "urgente", color: "bg-red-100 text-red-700", category: "prioridade", count: 12 },
    { id: "2", name: "hardware", color: "bg-blue-100 text-blue-700", category: "categoria", count: 25 },
    { id: "3", name: "software", color: "bg-green-100 text-green-700", category: "categoria", count: 31 },
    { id: "4", name: "rede", color: "bg-purple-100 text-purple-700", category: "categoria", count: 18 },
    { id: "5", name: "impressora", color: "bg-orange-100 text-orange-700", category: "equipamento", count: 8 },
    { id: "6", name: "email", color: "bg-pink-100 text-pink-700", category: "serviço", count: 15 },
    { id: "7", name: "acesso", color: "bg-indigo-100 text-indigo-700", category: "segurança", count: 22 },
    { id: "8", name: "backup", color: "bg-gray-100 text-gray-700", category: "dados", count: 6 },
    { id: "9", name: "vip", color: "bg-yellow-100 text-yellow-700", category: "cliente", count: 4 },
    { id: "10", name: "recorrente", color: "bg-red-100 text-red-800", category: "tipo", count: 9 }
  ];

  const [availableTags, setAvailableTags] = useState<TagItem[]>(predefinedTags);

  const filteredTags = availableTags.filter(tag =>
    tag.name && tag.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleTagToggle = (tagName: string) => {
    const newTags = selectedTags.includes(tagName)
      ? selectedTags.filter(t => t !== tagName)
      : [...selectedTags, tagName];
    
    onTagsChange?.(newTags);
  };

  const handleCreateTag = () => {
    if (!newTagName.trim()) return;

    const newTag: TagItem = {
      id: Date.now().toString(),
      name: newTagName.toLowerCase().trim(),
      color: "bg-gray-100 text-gray-700",
      category: "personalizada",
      count: 0
    };

    setAvailableTags(prev => [...prev, newTag]);
    setNewTagName("");
    setShowCreateTag(false);
    
    // Auto-adicionar a nova tag
    onTagsChange?.([...selectedTags, newTag.name]);
  };

  const removeTag = (tagName: string) => {
    onTagsChange?.(selectedTags.filter(t => t !== tagName));
  };

  const getTagColor = (tagName: string) => {
    const tag = availableTags.find(t => t.name === tagName);
    return tag?.color || "bg-gray-100 text-gray-700";
  };

  if (mode === "display") {
    return (
      <div className="flex gap-1 flex-wrap">
        {selectedTags.map((tagName) => (
          <Badge key={tagName} className={getTagColor(tagName)}>
            <Hash className="h-3 w-3 mr-1" />
            {tagName}
          </Badge>
        ))}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Tag className="h-5 w-5" />
          {mode === "filter" ? "Filtrar por Tags" : "Tags do Chamado"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Selected Tags */}
        {selectedTags.length > 0 && (
          <div>
            <label className="block text-sm font-medium mb-2">Tags selecionadas:</label>
            <div className="flex gap-1 flex-wrap">
              {selectedTags.map((tagName) => (
                <Badge key={tagName} className={`${getTagColor(tagName)} pr-1`}>
                  <Hash className="h-3 w-3 mr-1" />
                  {tagName}
                  {mode === "edit" && (
                    <Button
                      aria-label={`Remover tag ${tagName}`}
                      variant="ghost"
                      size="sm"
                      onClick={() => removeTag(tagName)}
                      className="h-4 w-4 p-0 ml-1 hover:bg-red-200"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Buscar tags..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Available Tags */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium">Tags disponíveis:</label>
            {mode === "edit" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCreateTag(true)}
                className="flex items-center gap-1"
              >
                <Plus className="h-3 w-3" />
                Nova Tag
              </Button>
            )}
          </div>

          {/* Create New Tag */}
          {showCreateTag && (
            <div className="flex gap-2 mb-3 p-3 border rounded-lg bg-gray-50">
              <Input
                placeholder="Nome da nova tag..."
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleCreateTag()}
                className="flex-1"
              />
              <Button onClick={handleCreateTag} disabled={!newTagName.trim()}>
                Criar
              </Button>
              <Button variant="outline" onClick={() => setShowCreateTag(false)}>
                Cancelar
              </Button>
            </div>
          )}

          {/* Tags Grid */}
          <div className="flex gap-1 flex-wrap max-h-48 overflow-y-auto">
            {filteredTags.map((tag) => {
              const isSelected = selectedTags.includes(tag.name);
              
              return (
                <Badge
                  key={tag.id}
                  variant={isSelected ? "default" : "outline"}
                  className={`cursor-pointer hover:opacity-80 ${isSelected ? "" : "hover:bg-gray-100"}`}
                  onClick={() => handleTagToggle(tag.name)}
                >
                  <Hash className="h-3 w-3 mr-1" />
                  {tag.name}
                  {mode === "filter" && (
                    <span className="ml-1 text-xs opacity-70">({tag.count})</span>
                  )}
                </Badge>
              );
            })}
          </div>

          {filteredTags.length === 0 && (
            <div className="text-center py-4 text-gray-500">
              <Tag className="h-8 w-8 mx-auto mb-2 text-gray-300" />
              <p className="text-sm">Nenhuma tag encontrada</p>
            </div>
          )}
        </div>

        {/* Categories (for filter mode) */}
        {mode === "filter" && (
          <div>
            <label className="text-sm font-medium mb-2 block">Por categoria:</label>
            <div className="grid grid-cols-2 gap-2">
              {["prioridade", "categoria", "equipamento", "serviço", "segurança", "dados"].map(category => {
                const categoryTags = availableTags.filter(t => t.category === category);
                const totalCount = categoryTags.reduce((sum, tag) => sum + tag.count, 0);
                
                return (
                  <Button
                    key={category}
                    variant="outline"
                    size="sm"
                    className="justify-between"
                    onClick={() => {
                      const categoryTagNames = categoryTags.map(t => t.name);
                      const newTags = [...new Set([...selectedTags, ...categoryTagNames])];
                      onTagsChange?.(newTags);
                    }}
                  >
                    <span className="capitalize">{category}</span>
                    <Badge variant="secondary" className="ml-2">
                      {totalCount}
                    </Badge>
                  </Button>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
