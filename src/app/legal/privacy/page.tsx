export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-[hsl(222,47%,11%)] p-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-8">Privacy Policy</h1>

        <div className="prose prose-invert max-w-none">
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6 mb-6">
            <p className="text-gray-300 leading-relaxed">
              <strong>Last Updated:</strong> March 14, 2026
            </p>
          </div>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-white mb-4">1. Information We Collect</h2>
            <p className="text-gray-300 leading-relaxed mb-4">
              We collect information to provide better services to our users:
            </p>
            <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4">
              <li><strong>Account Information:</strong> Email address, password (hashed)</li>
              <li><strong>Broker Credentials:</strong> API keys (encrypted at rest)</li>
              <li><strong>Trading Data:</strong> Trade history, signals, bot configurations</li>
              <li><strong>Usage Data:</strong> Platform interactions, timestamps</li>
              <li><strong>Technical Data:</strong> IP address, browser type, device information</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-white mb-4">2. How We Use Information</h2>
            <p className="text-gray-300 leading-relaxed mb-4">
              We use the information we collect to:
            </p>
            <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4">
              <li>Provide and maintain the Platform</li>
              <li>Execute trades on your behalf through your connected broker</li>
              <li>Monitor bot performance and generate trading signals</li>
              <li>Send you technical notices and security alerts</li>
              <li>Improve and personalize your experience</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-white mb-4">3. Data Security</h2>
            <p className="text-gray-300 leading-relaxed mb-4">
              We implement security measures to protect your data:
            </p>
            <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4">
              <li>API credentials encrypted with AES-256-GCM</li>
              <li>HTTPS encryption for all data in transit</li>
              <li>Firebase Authentication for secure user management</li>
              <li>Regular security audits and monitoring</li>
            </ul>
            <p className="text-gray-300 leading-relaxed mt-4">
              However, no method of transmission over the Internet is 100% secure. We cannot
              guarantee absolute security.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-white mb-4">4. Data Sharing</h2>
            <p className="text-gray-300 leading-relaxed">
              We do not sell your personal information. We only share data with:
            </p>
            <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4 mt-2">
              <li><strong>Your Broker:</strong> To execute trades (Alpaca, etc.)</li>
              <li><strong>Service Providers:</strong> Database hosting (Neon), Authentication (Firebase)</li>
              <li><strong>Legal Requirements:</strong> If required by law or to protect rights</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-white mb-4">5. Your Rights</h2>
            <p className="text-gray-300 leading-relaxed mb-4">You have the right to:</p>
            <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4">
              <li>Access your personal data</li>
              <li>Correct inaccurate data</li>
              <li>Request deletion of your data</li>
              <li>Export your trading history</li>
              <li>Revoke broker API access at any time</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-white mb-4">6. Data Retention</h2>
            <p className="text-gray-300 leading-relaxed">
              We retain your data for as long as your account is active. Trade history is retained
              for 7 years for tax and regulatory compliance. You may request deletion at any time.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-white mb-4">7. Cookies</h2>
            <p className="text-gray-300 leading-relaxed">
              We use session cookies for authentication. These are essential for the Platform to
              function and cannot be disabled.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-white mb-4">8. Changes to This Policy</h2>
            <p className="text-gray-300 leading-relaxed">
              We may update this Privacy Policy from time to time. We will notify you of significant
              changes via email or a prominent notice on the Platform.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-white mb-4">9. Contact Us</h2>
            <p className="text-gray-300 leading-relaxed">
              If you have questions about this Privacy Policy, please contact support through the
              Platform.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
