import type { Metadata } from "next";
import { BridgeArt } from "../../components/bridge-art";
import style from "./code-of-conduct.module.css";

export const metadata: Metadata = {
	title: "Code of Conduct",
	description:
		"Read the SacTech Slack Code of Conduct and learn how to contact an organizer or moderator for help.",
};

const policySections = [
	{ href: "#scope", label: "Where the policy applies" },
	{ href: "#harassment", label: "Harassment is not welcome" },
	{ href: "#stop-when-asked", label: "If someone asks you to stop" },
	{ href: "#shared-responsibility", label: "Shared responsibility" },
	{ href: "#enforcement", label: "How organizers may respond" },
	{ href: "#reporting-and-support", label: "Reporting and support" },
];

export default function CodeOfConductPage() {
	return (
		<main className={style.page} id="main-content">
			<section aria-labelledby="page-title" className={style.hero}>
				<div className={style.heroInner}>
					<div className={style.heroCopy}>
						<p className={style.eyebrow}>Code of Conduct</p>
						<h1 id="page-title">Build community with care.</h1>
						<p>
							Everyone deserves to participate in the SacTech Slack without
							harassment. This policy explains what we expect, how organizers
							may respond, and where members can ask for help.
						</p>
					</div>
					<BridgeArt className={style.heroArt} compact />
				</div>
			</section>

			<section
				aria-labelledby="summary-title"
				className={style.summarySection}
				id="at-a-glance"
			>
				<div className={style.summary}>
					<div className={style.summaryIntro}>
						<p className={style.summaryLabel}>At a glance</p>
						<h2 id="summary-title">Be excellent to each other.</h2>
					</div>
					<div className={style.summaryDetails}>
						<p className={style.summaryNote}>
							<strong>This is a friendly, non-exhaustive summary.</strong> It is
							not a replacement for the full policy. If the two differ, follow
							the full policy below.
						</p>
						<ul>
							<li>Help keep the SacTech Slack free from harassment.</li>
							<li>
								If someone asks you to stop harassing behavior, stop
								immediately.
							</li>
							<li>
								Organizers and moderators may warn or remove people who violate
								the policy.
							</li>
						</ul>
						<a className={style.readPolicyLink} href="#full-policy">
							Read the full policy <span aria-hidden="true">↓</span>
						</a>
					</div>
				</div>
			</section>

			<section aria-label="Full Code of Conduct" className={style.policyArea}>
				<div className={style.policyLayout}>
					<nav aria-label="Code of Conduct sections" className={style.index}>
						<p>On this page</p>
						<ol>
							{policySections.map((section) => (
								<li key={section.href}>
									<a href={section.href}>{section.label}</a>
								</li>
							))}
						</ol>
					</nav>

					<article
						aria-labelledby="policy-title"
						className={style.policy}
						id="full-policy"
					>
						<header className={style.policyIntro}>
							<p className={style.policyEyebrow}>The full policy</p>
							<h2 id="policy-title">SacTech Slack Code of Conduct</h2>
							<p>
								Every member of the SacTech Slack is required to agree to this
								Code of Conduct. SacTech organizers and moderators will enforce
								it throughout the workspace. We expect every participant to
								cooperate in helping ensure a safe environment for everyone.
							</p>
						</header>

						<section aria-labelledby="scope-title" id="scope">
							<h3 id="scope-title">1. Where this policy applies</h3>
							<p>
								This Code of Conduct currently governs participation in the
								SacTech Slack workspace and its channels. Sponsors, volunteers,
								organizers, and moderators participating there are also covered.
							</p>
							<p>
								It does not currently define SacTech policy for in-person events,
								independent social media, or other spaces. Expanding that scope
								will require a separate community policy decision.
							</p>
						</section>

						<section aria-labelledby="harassment-title" id="harassment">
							<h3 id="harassment-title">2. Harassment is not welcome</h3>
							<p>
								The SacTech Slack is dedicated to providing a harassment-free
								communication experience for everyone, regardless of gender,
								gender identity and expression, age, sexual orientation,
								disability, physical appearance, body size, race, or religion
								(or lack of religion). We do not tolerate harassment of Slack
								participants in any form.
							</p>
							<p>
								Harassment includes offensive comments related to gender, gender
								identity and expression, age, sexual orientation, disability,
								physical appearance, body size, race, or religion; sexual images;
								deliberate intimidation; stalking; sustained disruption of
								channels or other Slack communication; and unwelcome sexual
								attention.
							</p>
							<p>
								Sexual language and imagery are not appropriate in the SacTech
								Slack workspace.
							</p>
						</section>

						<section
							aria-labelledby="stop-when-asked-title"
							id="stop-when-asked"
						>
							<h3 id="stop-when-asked-title">3. If someone asks you to stop</h3>
							<p>
								Participants asked to stop any harassing behavior are expected
								to comply immediately.
							</p>
						</section>

						<section
							aria-labelledby="shared-responsibility-title"
							id="shared-responsibility"
						>
							<h3 id="shared-responsibility-title">4. Shared responsibility</h3>
							<p>
								Sponsors participating in the SacTech Slack are subject to this
								anti-harassment policy. They must not use sexualized images,
								activities, or other material in the workspace. SacTech
								organizers, moderators, and volunteers must not use sexualized
								content or otherwise create a sexualized environment.
							</p>
						</section>

						<section aria-labelledby="enforcement-title" id="enforcement">
							<h3 id="enforcement-title">5. How organizers may respond</h3>
							<p>
								If a participant engages in harassing behavior, SacTech
								organizers and moderators may take any action they consider
								appropriate, including warning the participant or removing them
								from the Slack workspace.
							</p>
						</section>

						<section
							aria-labelledby="reporting-title"
							id="reporting-and-support"
						>
							<h3 id="reporting-title">6. Reporting and support</h3>
							<div className={style.reportingCard}>
								<h4>Need help or want to report a concern?</h4>
								<p>
									If you are being harassed, notice that someone else is being
									harassed, or have any other concerns, contact a SacTech
									organizer or moderator through the Slack Team Directory.
								</p>
								<p className={style.publicPathNote}>
									<strong>For people outside Slack:</strong> SacTech is still
									establishing a public reporting path. There is not a public
									contact method on this site yet.
								</p>
							</div>
							<p>
								If requested, SacTech organizers and moderators can help
								participants contact local law enforcement or otherwise support
								people experiencing harassment so they can feel safe in the
								Slack workspace. We value your participation in this community.
							</p>
						</section>
					</article>
				</div>
			</section>
		</main>
	);
}
