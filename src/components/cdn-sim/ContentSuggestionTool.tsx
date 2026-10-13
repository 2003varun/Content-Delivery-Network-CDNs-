
"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Lightbulb, Loader2, AlertTriangle } from 'lucide-react';
import { suggestAlternativeContent, SuggestAlternativeContentInput, SuggestAlternativeContentOutput } from '@/ai/flows/suggest-alternative-content';
import { useForm, SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from '@/hooks/use-toast';

const formSchema = z.object({
  initialRequest: z.string().min(10, { message: "Please describe your content idea in at least 10 characters." }),
});
type FormData = z.infer<typeof formSchema>;

export function ContentSuggestionTool() {
  const [isOpen, setIsOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<SuggestAlternativeContentOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const { register, handleSubmit, formState: { errors }, setValue } = useForm<FormData>({
    resolver: zodResolver(formSchema),
  });

  const onSubmit: SubmitHandler<FormData> = async (data) => {
    setIsLoading(true);
    setError(null);
    setSuggestions(null);
    try {
      const result = await suggestAlternativeContent({ initialRequest: data.initialRequest });
      setSuggestions(result);
    } catch (err) {
      console.error("Error fetching content suggestions:", err);
      setError("Failed to get suggestions. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuggestionClick = (content: string) => {
    setValue("initialRequest", content);
    toast({
      title: "Suggestion Copied",
      description: "The content idea has been copied to the textarea.",
      duration: 3000,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="h-10 px-4 text-xs sm:text-sm font-medium border border-border/80 bg-secondary/40 text-foreground hover:bg-secondary/70 hover:border-slate-600 rounded-lg shadow-sm transition-all flex items-center gap-2">
          <Lightbulb className="mr-1.5 h-4 w-4 text-amber-400" />
          Get Content Suggestions
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[580px] bg-card text-card-foreground border border-border/80 rounded-xl shadow-2xl p-6">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold tracking-tight text-foreground">Content Caching Advisor</DialogTitle>
          <DialogDescription className="text-xs sm:text-sm text-muted-foreground mt-1 leading-relaxed">
            Enter your video content idea, and our AI will suggest alternatives that are easily cacheable on a CDN. Click a suggestion to edit it.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-5 py-3">
          <div className="grid gap-1.5">
            <Label htmlFor="initialRequest" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Your Content Idea</Label>
            <Textarea
              id="initialRequest"
              placeholder="e.g., Live stream of a sports game, personalized video messages"
              {...register("initialRequest")}
              className="min-h-[100px] bg-background/80 border-border text-foreground focus:ring-1 focus:ring-primary rounded-lg text-sm placeholder:text-muted-foreground/60"
            />
            {errors.initialRequest && <p className="text-xs text-destructive mt-1">{errors.initialRequest.message}</p>}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isLoading} className="w-full sm:w-auto shadow-sm hover:shadow transition-shadow rounded-lg text-sm font-medium">
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Getting Suggestions...
                </>
              ) : (
                "Suggest Alternatives"
              )}
            </Button>
          </DialogFooter>
        </form>

        {error && (
          <div className="mt-3 p-3 bg-destructive/10 border border-destructive/30 text-destructive text-sm rounded-lg flex items-center gap-2.5">
            <AlertTriangle size={18} className="shrink-0" />
            <p className="text-xs">{error}</p>
          </div>
        )}

        {suggestions && suggestions.suggestions.length > 0 && (
          <div className="mt-5 space-y-3 max-h-[280px] overflow-y-auto pr-1">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">AI Suggestions:</h3>
            {suggestions.suggestions.map((suggestion, index) => (
              <div
                key={index}
                className="bg-secondary/40 border border-border/70 rounded-lg shadow-sm cursor-pointer hover:bg-secondary/70 hover:border-primary/40 transition-all p-3.5 space-y-1 focus:outline-none focus:ring-1 focus:ring-primary"
                onClick={() => handleSuggestionClick(suggestion.content)}
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleSuggestionClick(suggestion.content); }}
              >
                <h4 className="text-sm font-semibold text-primary">{suggestion.content}</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">{suggestion.reason}</p>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
