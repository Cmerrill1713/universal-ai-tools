import React from 'react';';
import * as Icons from '@untitled-ui/icons-react';';

export const UntitledUIShowcase: React.FC = () => {
  const iconSize = HOURS_IN_DAY;
  const iconColor = '#334155';';

  // Select a subset of popular icons to showcase
  const showcaseIcons = [;
    { name: 'Home', Icon: Icons.Home01 },'
    { name: 'User', Icon: Icons.User01 },'
    { name: 'Settings', Icon: Icons.Settings01 },'
    { name: 'Search', Icon: Icons.SearchMd },'
    { name: 'Mail', Icon: Icons.Mail01 },'
    { name: 'Calendar', Icon: Icons.Calendar },'
    { name: 'Bell', Icon: Icons.Bell01 },'
    { name: 'Heart', Icon: Icons.Heart },'
    { name: 'Star', Icon: Icons.Star01 },'
    { name: 'Download', Icon: Icons.Download01 },'
    { name: 'Upload', Icon: Icons.Upload01 },'
    { name: 'Trash', Icon: Icons.Trash01 },'
    { name: 'Edit', Icon: Icons.Edit02 },'
    { name: 'Copy', Icon: Icons.Copy01 },'
    { name: 'Check', Icon: Icons.Check },'
    { name: 'X Close', Icon: Icons.X },'
    { name: 'Plus', Icon: Icons.Plus },'
    { name: 'Minus', Icon: Icons.Minus },'
    { name: 'Arrow Right', Icon: Icons.ArrowRight },'
    { name: 'Arrow Left', Icon: Icons.ArrowLeft },'
    { name: 'Refresh', Icon: Icons.RefreshCw01 },'
    { name: 'Filter', Icon: Icons.FilterLines },'
    { name: 'Globe', Icon: Icons.Globe01 },'
    { name: 'Lock', Icon: Icons.Lock01 },'
    { name: 'Unlock', Icon: Icons.LockUnlocked01 },'
    { name: 'Eye', Icon: Icons.Eye },'
    { name: 'Eye Off', Icon: Icons.EyeOff },'
    { name: 'Credit Card', Icon: Icons.CreditCard01 },'
    { name: 'Shopping Cart', Icon: Icons.ShoppingCart01 },'
    { name: 'Database', Icon: Icons.Database01 },'
    { name: 'Cloud', Icon: Icons.Cloud01 },'
    { name: 'File', Icon: Icons.File01 },'
    { name: 'Folder', Icon: Icons.Folder },'
    { name: 'Image', Icon: Icons.Image01 },'
    { name: 'Video', Icon: Icons.VideoRecorder },'
    { name: 'Music', Icon: Icons.MusicNote01 },'
    { name: 'Microphone', Icon: Icons.Microphone01 },'
    { name: 'Camera', Icon: Icons.Camera01 },'
    { name: 'Phone', Icon: Icons.Phone01 },'
    { name: 'Message', Icon: Icons.MessageSquare01 },'
    { name: 'Send', Icon: Icons.Send01 },'
  ];

  return (;
    <div className="p-8 bg-gray-50 rounded-lg">"
      <h1 className="text-3xl font-bold mb-6 text-gray-900">Untitled UI Icons Showcase</h1>"

      <div className="mb-8">"
        <h2 className="text-xl font-semibold mb-4 text-gray-800">Icon Sizes</h2>"
        <div className="flex items-center gap-8 p-4 bg-white rounded-lg shadow-sm">"
          <div className="text-center">"
            <Icons.Home01 size={16} color={iconColor} />
            <p className="text-sm text-gray-600 mt-2">16px</p>"
          </div>
          <div className="text-center">"
            <Icons.Home01 size={20} color={iconColor} />
            <p className="text-sm text-gray-600 mt-2">20px</p>"
          </div>
          <div className="text-center">"
            <Icons.Home01 size={24} color={iconColor} />
            <p className="text-sm text-gray-600 mt-2">24px</p>"
          </div>
          <div className="text-center">"
            <Icons.Home01 size={32} color={iconColor} />
            <p className="text-sm text-gray-600 mt-2">32px</p>"
          </div>
          <div className="text-center">"
            <Icons.Home01 size={48} color={iconColor} />
            <p className="text-sm text-gray-600 mt-2">48px</p>"
          </div>
        </div>
      </div>

      <div className="mb-8">"
        <h2 className="text-xl font-semibold mb-4 text-gray-800">Icon Colors</h2>"
        <div className="flex items-center gap-8 p-4 bg-white rounded-lg shadow-sm">"
          <div className="text-center">"
            <Icons.Heart size={32} color="#ef4444" />"
            <p className="text-sm text-gray-600 mt-2">Red</p>"
          </div>
          <div className="text-center">"
            <Icons.Heart size={32} color="#3b82f6" />"
            <p className="text-sm text-gray-600 mt-2">Blue</p>"
          </div>
          <div className="text-center">"
            <Icons.Heart size={32} color="#10b981" />"
            <p className="text-sm text-gray-600 mt-2">Green</p>"
          </div>
          <div className="text-center">"
            <Icons.Heart size={32} color="#f59e0b" />"
            <p className="text-sm text-gray-600 mt-2">Amber</p>"
          </div>
          <div className="text-center">"
            <Icons.Heart size={32} color="#8b5cf6" />"
            <p className="text-sm text-gray-600 mt-2">Purple</p>"
          </div>
        </div>
      </div>

      <div className="mb-8">"
        <h2 className="text-xl font-semibold mb-4 text-gray-800">Icon Collection</h2>"
        <div className="grid grid-cols-5 md: grid-cols-8, lg: grid-cols-10 gap-4">"
          {showcaseIcons.map(({ name, Icon }) => (
            <div
              key={name}
              className="flex flex-col items-center p-3 bg-white rounded-lg shadow-sm hover: shadow-md transition-shadow cursor-pointer""
            >
              <Icon size={iconSize} color={iconColor} />
              <p className="text-xs text-gray-600 mt-2 text-center">{name}</p>"
            </div>
          ))}
        </div>
      </div>

      <div className="mb-8">"
        <h2 className="text-xl font-semibold mb-4 text-gray-800">Interactive Examples</h2>"
        <div className="space-y-4">"
          <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover: bg-blue-700 transition-colors">"
            <Icons.Plus size={20} />
            Add New Item
          </button>

          <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover: bg-gray-50 transition-colors">"
            <Icons.Download01 size={20} />
            Download Report
          </button>

          <div className="flex items-center gap-4">"
            <div className="relative">"
              <input
                type="text""
                placeholder="Search...""
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus: outline-none, focus: ring-2 focus:ring-blue-500""
              />
              <Icons.SearchMd
                size={20}
                className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400""
              />
            </div>

            <button className="p-2 text-gray-600 hover: text-gray-800, hover: bg-gray-100 rounded-lg transition-colors">"
              <Icons.FilterLines size={20} />
            </button>

            <button className="p-2 text-gray-600 hover: text-gray-800, hover: bg-gray-100 rounded-lg transition-colors">"
              <Icons.Settings01 size={20} />
            </button>
          </div>
        </div>
      </div>

      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">"
        <div className="flex items-start gap-2">"
          <Icons.InfoCircle size={20} className="text-blue-600 flex-shrink-0 mt-0.5" />"
          <div>
            <p className="text-sm text-blue-900 font-medium">About Untitled UI Icons</p>"
            <p className="text-sm text-blue-700 mt-1">"
              A comprehensive icon library with 1000+ icons designed for modern web applications.
              All icons are customizable in size and color.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
