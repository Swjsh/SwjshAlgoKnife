export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-[hsl(222,47%,11%)] p-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-8">Terms of Service</h1>

        <div className="prose prose-invert max-w-none">
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6 mb-6">
            <p className="text-gray-300 leading-relaxed">
              <strong>Last Updated:</strong> March 14, 2026
            </p>
          </div>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-white mb-4">1. Acceptance of Terms</h2>
            <p className="text-gray-300 leading-relaxed">
              By accessing and using SwjshAK ("the Platform"), you accept and agree to be bound by
              the terms and provisions of this agreement.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-white mb-4">2. Use License</h2>
            <p className="text-gray-300 leading-relaxed mb-4">
              Permission is granted to temporarily use the Platform for personal, non-commercial
              automated trading purposes.
            </p>
            <p className="text-gray-300 leading-relaxed">
              This license does not include:
            </p>
            <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4">
              <li>Modifying or copying the materials</li>
              <li>Using the materials for commercial purposes or public display</li>
              <li>Attempting to reverse engineer any software contained on the Platform</li>
              <li>Removing any copyright or proprietary notations from the materials</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-white mb-4">3. Trading Risks</h2>
            <p className="text-gray-300 leading-relaxed mb-4">
              <strong className="text-yellow-400">IMPORTANT:</strong> Trading involves substantial
              risk of loss and is not suitable for all investors. Past performance is not indicative
              of future results.
            </p>
            <p className="text-gray-300 leading-relaxed">
              By using this Platform, you acknowledge that:
            </p>
            <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4">
              <li>You are solely responsible for all trading decisions</li>
              <li>The Platform and its creators provide software tools only, not financial advice</li>
              <li>Automated trading systems can malfunction</li>
              <li>You may lose all invested capital</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-white mb-4">4. Disclaimer</h2>
            <p className="text-gray-300 leading-relaxed">
              The materials on the Platform are provided on an 'as is' basis. SwjshAK makes no
              warranties, expressed or implied, and hereby disclaims and negates all other warranties
              including, without limitation, implied warranties or conditions of merchantability,
              fitness for a particular purpose, or non-infringement of intellectual property or
              other violation of rights.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-white mb-4">5. Limitations</h2>
            <p className="text-gray-300 leading-relaxed">
              In no event shall SwjshAK or its suppliers be liable for any damages (including,
              without limitation, damages for loss of data, profit, or trading losses) arising
              out of the use or inability to use the Platform.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-white mb-4">6. Contact</h2>
            <p className="text-gray-300 leading-relaxed">
              For questions about these Terms, please contact support through the Platform.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
