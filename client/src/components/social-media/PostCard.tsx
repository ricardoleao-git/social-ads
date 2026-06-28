import { Card } from "@/components/ui/card";
import { Heart, MessageCircle, Share2, Play } from "lucide-react";
import { InstagramPost } from "@/lib/social-media/mockData";

interface PostCardProps {
  post: InstagramPost;
}

export default function PostCard({ post }: PostCardProps) {
  const isVideo = post.mediaType === "VIDEO";
  const imageUrl = isVideo ? (post.thumbnailUrl || post.mediaUrl) : post.mediaUrl;

  return (
    <Card className="overflow-hidden border-0 shadow-sm hover:shadow-lg transition-shadow">
      <div className="relative bg-gray-100 aspect-square overflow-hidden">
        <img
          src={imageUrl}
          alt={post.caption}
          className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
        />
        {isVideo && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/30 transition-colors">
            <div className="bg-white/90 rounded-full p-3">
              <Play className="w-6 h-6 text-blue-600 fill-blue-600" />
            </div>
          </div>
        )}
      </div>

      <div className="p-4">
        <p className="text-sm text-gray-600 line-clamp-2 mb-3">
          {post.caption}
        </p>

        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-4 text-gray-600">
            <div className="flex items-center gap-1">
              <Heart className="w-4 h-4" />
              <span className="font-medium">{post.likes}</span>
            </div>
            <div className="flex items-center gap-1">
              <MessageCircle className="w-4 h-4" />
              <span className="font-medium">{post.comments}</span>
            </div>
          </div>
          <div className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded">
            {post.engagement.toFixed(1)}% eng.
          </div>
        </div>

        <a
          href={post.permalink}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 block w-full text-center text-xs font-semibold text-blue-600 hover:text-blue-700 py-2 rounded hover:bg-blue-50 transition-colors"
        >
          Ver no Instagram →
        </a>
      </div>
    </Card>
  );
}
