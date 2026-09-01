param(
  [Parameter(Mandatory = $true)] [string]$InputPath,
  [Parameter(Mandatory = $true)] [string]$OutputPath
)

Add-Type -AssemblyName System.Drawing
$drawingAssembly = [System.Drawing.Bitmap].Assembly.Location
Add-Type -ReferencedAssemblies $drawingAssembly -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;

public static class HealthAirAvatarCutout
{
    private static bool IsBackground(Color color)
    {
        int minimum = Math.Min(color.R, Math.Min(color.G, color.B));
        int maximum = Math.Max(color.R, Math.Max(color.G, color.B));
        return minimum >= 218 && maximum - minimum <= 22;
    }

    public static void Run(string inputPath, string outputPath)
    {
        using (var source = new Bitmap(inputPath))
        using (var result = new Bitmap(source.Width, source.Height, PixelFormat.Format32bppArgb))
        {
            int width = source.Width;
            int height = source.Height;
            var visited = new bool[width * height];
            var queue = new Queue<int>(width * 2 + height * 2);

            for (int x = 0; x < width; x++)
            {
                queue.Enqueue(x);
                queue.Enqueue((height - 1) * width + x);
            }
            for (int y = 1; y < height - 1; y++)
            {
                queue.Enqueue(y * width);
                queue.Enqueue(y * width + width - 1);
            }

            while (queue.Count > 0)
            {
                int index = queue.Dequeue();
                if (visited[index]) continue;
                int x = index % width;
                int y = index / width;
                if (!IsBackground(source.GetPixel(x, y))) continue;

                visited[index] = true;
                if (x > 0) queue.Enqueue(index - 1);
                if (x < width - 1) queue.Enqueue(index + 1);
                if (y > 0) queue.Enqueue(index - width);
                if (y < height - 1) queue.Enqueue(index + width);
            }

            using (var graphics = Graphics.FromImage(result))
                graphics.DrawImageUnscaled(source, 0, 0);

            for (int y = 0; y < height; y++)
                for (int x = 0; x < width; x++)
                    if (visited[y * width + x])
                        result.SetPixel(x, y, Color.Transparent);

            Directory.CreateDirectory(Path.GetDirectoryName(outputPath));
            result.Save(outputPath, ImageFormat.Png);
        }
    }
}
'@

[HealthAirAvatarCutout]::Run(
  [System.IO.Path]::GetFullPath($InputPath),
  [System.IO.Path]::GetFullPath($OutputPath)
)
