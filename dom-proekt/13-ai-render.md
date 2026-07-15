# 13 · AI 3D-рендер — промпты и сервисы

← [Оглавление](00-ОГЛАВЛЕНИЕ.md)

Как получить фотореалистичные «фотографии» дома с помощью нейросетей.
Промпты составлены под ваш проект: дом 14 × 13 м, плоская крыша, монолитный каркас,
газоблок, **двусветный зал-студия 80 м² у фасада** с панорамным остеклением на двор.

> ⚠️ Text-to-image даёт красиво, но **не точно по размерам**. Для точности —
> режим **sketch/image-to-render**: загрузите в сервис ваш план
> ([`assets/floors.svg`](../assets/floors.svg)) или скрин 3D-массинга как референс.

---

## 1. Экстерьер (вечер, золотой час) — вставить в Midjourney / Krea / DALL·E

```
Photorealistic architectural photography of a modern two-story private house,
flat roof, clean rectangular volume 14 x 13 m, the front facade dominated by a
double-height living room with full-height panoramic glazing about 6 m tall
facing a landscaped front garden, minimalist contemporary Armenian style,
white plaster walls with warm travertine / tuff stone accents, slim dark window
frames, front yard with driveway and parking, golden-hour evening light, warm
interior glow through the glass, soft long shadows, subtle Caucasus mountains in
the background, ultra-detailed, 35mm architectural photo, high dynamic range
--ar 16:9 --style raw --v 6
```

## 2. Интерьер — двусветный зал + кухня-студия

```
Photorealistic interior render of a double-height living room 8 x 10 m with a
6 m ceiling, floor-to-ceiling panoramic windows facing a green garden, open-plan
studio combining the living room with a modern kitchen, a large sliding glass
partition between kitchen and hall, a second-floor gallery balcony overlooking
the hall, warm minimalist interior, oak wood floor, white walls, large linen
sofa, sculptural pendant lights, abundant natural daylight, Scandinavian-Armenian
contemporary, ultra-detailed architectural interior photography
--ar 3:2 --style raw --v 6
```

## 3. Дневной экстерьер со двора (фронтально)

```
Photorealistic front elevation photo of a modern two-story house, symmetrical
14 m wide facade, huge double-height glass living room in the center, white
render and warm stone, flat roof with thin parapet, minimalist, bright overcast
daylight, manicured lawn, straight-on architectural shot, ultra sharp, 4k
--ar 16:9 --style raw --v 6
```

> **Для Stable Diffusion** добавьте negative prompt:
> `blurry, distorted, extra floors, cluttered, watermark, text, lowres, fisheye`

---

## Сервисы (что попробовать)

| Сервис | Тип | Плюс |
|---|---|---|
| **Midjourney v6** | text→image | лучший общий фотореализм |
| **Krea.ai** | image→image, realtime | быстро дорабатывать от вашего SVG-плана |
| **PromeAI** | sketch→render (архитектура) | понимает планы/скетчи |
| **myArchitectAI / ArkoAI** | план/фото→рендер | заточены под дома |
| **Maket.ai** | планировки + рендер | генерация планировок |
| **SD + ControlNet** (ComfyUI) | line/depth→render | максимальный контроль по чертежу |

---

## Как добиться точности по размерам

1. **Скормите план как референс.** В Krea / PromeAI / ControlNet загрузите
   [`floors.svg`](../assets/floors.svg) или его скрин → режим *sketch to image* /
   *edge/depth control*. Нейросеть достроит объём по вашей геометрии.
2. **Или сначала грубый 3D-массинг** (SketchUp / Twinmotion / Blender), скрин →
   в AI как img2img «enhance to photoreal». Так сохранятся пропорции.
3. **Итерации:** генерируйте сериями по 4, фиксируйте seed удачного кадра,
   меняйте только материалы/свет в промпте.
4. **Апскейл** финального кадра (Magnific / Topaz / встроенный upscale).

> Хотите — соберу **интерактивный 3D-массинг на Three.js прямо на сайте**, и его
> скрины можно будет использовать как точный референс для AI. Скажите слово.
